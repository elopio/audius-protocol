import logging
from datetime import datetime
from sqlalchemy.orm.session import make_transient
from sqlalchemy.sql import null
from src import contract_addresses
from src.utils import multihash, helpers
from src.models import Track, User, BlacklistedIPLD, Stem, Remix
from src.tasks.metadata import track_metadata_format

logger = logging.getLogger(__name__)

track_event_types_lookup = {
    'new_track': 'NewTrack',
    'update_track': 'UpdateTrack',
    'delete_track': 'TrackDeleted'
}

track_event_types_arr = [
    track_event_types_lookup['new_track'],
    track_event_types_lookup['update_track'],
    track_event_types_lookup['delete_track']
]

def track_state_update(self, update_task, session, track_factory_txs, block_number, block_timestamp):
    """Return int representing number of Track model state changes found in transaction."""
    num_total_changes = 0
    if not track_factory_txs:
        return num_total_changes

    track_abi = update_task.abi_values["TrackFactory"]["abi"]
    track_contract = update_task.web3.eth.contract(
        address=contract_addresses["track_factory"], abi=track_abi
    )
    track_events = {}
    for tx_receipt in track_factory_txs:
        for event_type in track_event_types_arr:
            track_events_tx = getattr(track_contract.events, event_type)().processReceipt(tx_receipt)
            for entry in track_events_tx:
                event_args = entry["args"]
                track_id = event_args._trackId if '_trackId' in event_args else event_args._id
                blockhash = update_task.web3.toHex(entry.blockHash)

                if track_id not in track_events:
                    track_entry = lookup_track_record(
                        update_task, session, entry, track_id, block_number, blockhash
                    )

                    track_events[track_id] = {
                        "track": track_entry,
                        "events": []
                    }

                track_events[track_id]["events"].append(event_type)
                track_events[track_id]["track"] = parse_track_event(
                    self,
                    session,
                    update_task,
                    entry,
                    event_type,
                    track_events[track_id]["track"],
                    block_timestamp)
            num_total_changes += len(track_events_tx)

    for track_id, value_obj in track_events.items():
        logger.info(f"tracks.py | Adding {value_obj['track']}")
        invalidate_old_track(session, track_id)
        session.add(value_obj["track"])

    return num_total_changes


def lookup_track_record(update_task, session, entry, event_track_id, block_number, block_hash):
    # Check if track record exists
    track_exists = (
        session.query(Track).filter_by(track_id=event_track_id).count() > 0
    )

    track_record = None
    if track_exists:
        track_record = (
            session.query(Track)
            .filter(Track.track_id == event_track_id, Track.is_current == True)
            .first()
        )

        # expunge the result from sqlalchemy so we can modify it without UPDATE statements being made
        # https://stackoverflow.com/questions/28871406/how-to-clone-a-sqlalchemy-db-object-with-new-primary-key
        session.expunge(track_record)
        make_transient(track_record)
    else:
        track_record = Track(
            track_id=event_track_id,
            is_current=True,
            is_delete=False
        )

    # update block related fields regardless of type
    track_record.blocknumber = block_number
    track_record.blockhash = block_hash
    return track_record


def invalidate_old_track(session, track_id):
    track_exists = (
        session.query(Track).filter_by(track_id=track_id).count() > 0
    )

    if not track_exists:
        return

    num_invalidated_tracks = (
        session.query(Track)
        .filter(Track.track_id == track_id, Track.is_current == True)
        .update({"is_current": False})
    )
    assert (
        num_invalidated_tracks > 0
    ), "Update operation requires a current track to be invalidated"

def update_stems_table(session, track_record, track_metadata):
    if (not "stem_of" in track_metadata) or (not isinstance(track_metadata["stem_of"], dict)):
        return
    parent_track_id = track_metadata["stem_of"].get("parent_track_id")
    if not isinstance(parent_track_id, int):
        return
    stem = Stem(parent_track_id=parent_track_id, child_track_id=track_record.track_id)
    session.add(stem)


def update_remixes_table(session, track_record, track_metadata):
    child_track_id = track_record.track_id

    # Delete existing remix parents
    session.query(Remix).filter_by(child_track_id=child_track_id).delete()

    # Add all remixes
    if "remix_of" in track_metadata and isinstance(track_metadata["remix_of"], dict):
        tracks = track_metadata["remix_of"].get("tracks")
        if tracks and isinstance(tracks, list):
            for track in tracks:
                parent_track_id = track.get("parent_track_id")
                if parent_track_id and isinstance(parent_track_id, int):
                    remix = Remix(
                        parent_track_id=parent_track_id,
                        child_track_id=child_track_id
                    )
                    session.add(remix)

def parse_track_event(
        self, session, update_task, entry, event_type, track_record, block_timestamp
    ):
    event_args = entry["args"]
    # Just use block_timestamp as integer
    block_datetime = datetime.utcfromtimestamp(block_timestamp)

    if event_type == track_event_types_lookup["new_track"]:
        track_record.created_at = block_datetime

        track_metadata_digest = event_args._multihashDigest.hex()
        track_metadata_hash_fn = event_args._multihashHashFn
        buf = multihash.encode(
            bytes.fromhex(track_metadata_digest), track_metadata_hash_fn
        )
        track_metadata_multihash = multihash.to_b58_string(buf)
        logger.info(f"track metadata ipld : {track_metadata_multihash}")

        # If the IPLD is blacklisted, do not keep processing the current entry
        # continue with the next entry in the update_track_events list
        if is_blacklisted_ipld(session, track_metadata_multihash):
            return track_record

        owner_id = event_args._trackOwnerId
        handle = (
            session.query(User.handle)
            .filter(User.user_id == owner_id, User.is_current == True)
            .first()
        )[0]
        track_record.owner_id = owner_id


        # Reconnect to creator nodes for this user
        refresh_track_owner_ipfs_conn(track_record.owner_id, session, update_task)

        track_record.is_delete = False
        track_metadata = update_task.ipfs_client.get_metadata(
            track_metadata_multihash,
            track_metadata_format
        )

        track_record = populate_track_record_metadata(
            track_record,
            track_metadata,
            handle
        )
        track_record.metadata_multihash = track_metadata_multihash

        # if cover_art CID is of a dir, store under _sizes field instead
        if track_record.cover_art:
            logger.warning(f"tracks.py | Processing track cover art {track_record.cover_art}")
            is_directory = update_task.ipfs_client.multihash_is_directory(track_record.cover_art)
            if is_directory:
                track_record.cover_art_sizes = track_record.cover_art
                track_record.cover_art = None

        update_stems_table(session, track_record, track_metadata)
        update_remixes_table(session, track_record, track_metadata)

    if event_type == track_event_types_lookup["update_track"]:
        upd_track_metadata_digest = event_args._multihashDigest.hex()
        upd_track_metadata_hash_fn = event_args._multihashHashFn
        update_buf = multihash.encode(
            bytes.fromhex(upd_track_metadata_digest), upd_track_metadata_hash_fn
        )
        upd_track_metadata_multihash = multihash.to_b58_string(update_buf)
        logger.info(f"update track metadata ipld : {upd_track_metadata_multihash}")

        # If the IPLD is blacklisted, do not keep processing the current entry
        # continue with the next entry in the update_track_events list
        if is_blacklisted_ipld(session, upd_track_metadata_multihash):
            return track_record

        owner_id = event_args._trackOwnerId
        handle = (
            session.query(User.handle)
            .filter(User.user_id == owner_id, User.is_current == True)
            .first()
        )[0]
        track_record.owner_id = owner_id
        track_record.is_delete = False

        # Reconnect to creator nodes for this user
        refresh_track_owner_ipfs_conn(track_record.owner_id, session, update_task)

        track_metadata = update_task.ipfs_client.get_metadata(
            upd_track_metadata_multihash,
            track_metadata_format
        )

        track_record = populate_track_record_metadata(
            track_record,
            track_metadata,
            handle
        )
        track_record.metadata_multihash = upd_track_metadata_multihash

        # if cover_art CID is of a dir, store under _sizes field instead
        if track_record.cover_art:
            logger.warning(f"tracks.py | Processing track cover art {track_record.cover_art}")
            is_directory = update_task.ipfs_client.multihash_is_directory(track_record.cover_art)
            if is_directory:
                track_record.cover_art_sizes = track_record.cover_art
                track_record.cover_art = None

        update_remixes_table(session, track_record, track_metadata)

    if event_type == track_event_types_lookup["delete_track"]:
        track_record.is_delete = True
        if not track_record.stem_of:
            track_record.stem_of = null()
        if not track_record.remix_of:
            track_record.remix_of = null()
        logger.info(f"Removing track : {track_record.track_id}")

    track_record.updated_at = block_datetime

    return track_record

def is_blacklisted_ipld(session, ipld_blacklist_multihash):
    ipld_blacklist_entry = (
        session.query(BlacklistedIPLD).filter(BlacklistedIPLD.ipld == ipld_blacklist_multihash)
    )
    return ipld_blacklist_entry.count() > 0

def is_valid_json_field(metadata, field):
    if field in metadata and isinstance(metadata[field], dict) and len(metadata[field]) > 0:
        return True
    return False

def populate_track_record_metadata(track_record, track_metadata, handle):
    track_record.title = track_metadata["title"]
    track_record.length = track_metadata["length"] or 0
    track_record.cover_art = track_metadata["cover_art"]
    if track_metadata["cover_art_sizes"]:
        track_record.cover_art = track_metadata["cover_art_sizes"]
    track_record.tags = track_metadata["tags"]
    track_record.genre = track_metadata["genre"]
    track_record.mood = track_metadata["mood"]
    track_record.credits_splits = track_metadata["credits_splits"]
    track_record.create_date = track_metadata["create_date"]
    track_record.release_date = track_metadata["release_date"]
    track_record.file_type = track_metadata["file_type"]
    track_record.description = track_metadata["description"]
    track_record.license = track_metadata["license"]
    track_record.isrc = track_metadata["isrc"]
    track_record.iswc = track_metadata["iswc"]
    track_record.track_segments = track_metadata["track_segments"]
    track_record.is_unlisted = track_metadata["is_unlisted"]
    track_record.field_visibility = track_metadata["field_visibility"]
    if is_valid_json_field(track_metadata, "stem_of"):
        track_record.stem_of = track_metadata["stem_of"]
    else:
        track_record.stem_of = null()
    if is_valid_json_field(track_metadata, "remix_of"):
        track_record.remix_of = track_metadata["remix_of"]
    else:
        track_record.remix_of = null()

    if "download" in track_metadata:
        track_record.download = {
            "is_downloadable": track_metadata["download"].get("is_downloadable") == True,
            "requires_follow": track_metadata["download"].get("requires_follow") == True,
            "cid": track_metadata["download"].get("cid", None),
        }
    else:
        track_record.download = {
            "is_downloadable": False,
            "requires_follow": False,
            "cid": None
        }

    track_record.route_id = helpers.create_track_route_id(track_metadata["title"], handle)
    return track_record

def refresh_track_owner_ipfs_conn(owner_id, session, update_task):
    owner_record = (
        session.query(User.creator_node_endpoint)
        .filter(
            User.is_current == True,
            User.user_id == owner_id)
        .all()
    )
    if len(owner_record) >= 1:
        parsed_endpoint_list = owner_record[0][0]
        helpers.update_ipfs_peers_from_user_endpoint(
            update_task,
            parsed_endpoint_list
        )
