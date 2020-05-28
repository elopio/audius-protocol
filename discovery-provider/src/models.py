import enum
from sqlalchemy.ext.declarative import declarative_base, declared_attr
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    Enum,
    PrimaryKeyConstraint,
)

Base = declarative_base()

class BlockMixin():

    @declared_attr
    def __tablename__(self, cls):
        return cls.__name__.lower()

    blockhash = Column(String, primary_key=True)
    number = Column(Integer, nullable=True, unique=True)
    parenthash = Column(String)
    is_current = Column(Boolean)


# inherits from BlockMixin
class Block(Base, BlockMixin):
    __tablename__ = "blocks"

    def __repr__(self):
        return f"<Block(blockhash={self.blockhash},\
parenthash={self.parenthash},number={self.number},\
is_current={self.is_current})>"


# inherits from BlockMixin
class IPLDBlacklistBlock(Base, BlockMixin):
    __tablename__ = "ipld_blacklist_blocks"

    def __repr__(self):
        return f"<IPLDBlacklistBlock(blockhash={self.blockhash},\
    parenthash={self.parenthash},number={self.number}\
    is_current={self.is_current})>"


class BlacklistedIPLD(Base):
    __tablename__ = "ipld_blacklists"

    blockhash = Column(String, ForeignKey("ipld_blacklist_blocks.blockhash"), nullable=False)
    blocknumber = Column(Integer, ForeignKey("ipld_blacklist_blocks.number"), nullable=False)
    ipld = Column(String, nullable=False)
    is_blacklisted = Column(Boolean, nullable=False)
    is_current = Column(Boolean, nullable=False)

    PrimaryKeyConstraint(blockhash, ipld, is_blacklisted, is_current)

    def __repr__(self):
        return f"<BlacklistedIPLD(blockhash={self.blockhash},\
blocknumber={self.blocknumber},ipld={self.ipld}\
is_blacklisted={self.is_blacklisted}, is_current={self.is_current})>"


class User(Base):
    __tablename__ = "users"

    blockhash = Column(String, ForeignKey("blocks.blockhash"), nullable=False)
    blocknumber = Column(Integer, ForeignKey("blocks.number"), nullable=False)
    user_id = Column(Integer, nullable=False)
    is_ready = Column(Boolean, nullable=False)
    is_current = Column(Boolean, nullable=False)
    handle = Column(String)
    handle_lc = Column(String, index=True)
    wallet = Column(String, index=True)
    is_creator = Column(Boolean, nullable=False, default=False)
    is_verified = Column(Boolean, nullable=False, default=False, server_default='false')
    name = Column(Text)
    profile_picture = Column(String)
    profile_picture_sizes = Column(String)
    cover_photo = Column(String)
    cover_photo_sizes = Column(String)
    bio = Column(String)
    location = Column(String)
    metadata_multihash = Column(String)
    creator_node_endpoint = Column(String)
    updated_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, nullable=False)

    # Primary key has to be combo of all 3 is_current/creator_id/blockhash
    PrimaryKeyConstraint(is_current, user_id, blockhash)

    def __repr__(self):
        return f"<User(blockhash={self.blockhash},\
blocknumber={self.blocknumber},\
user_id={self.user_id},\
is_ready={self.is_ready},\
is_current={self.is_current},\
handle={self.handle},\
wallet={self.wallet},\
is_creator={self.is_creator},\
name={self.name},\
profile_pic={self.profile_picture},\
profile_pic_sizes={self.profile_picture_sizes},\
cover_photo={self.cover_photo},\
cover_photo_sizes={self.cover_photo_sizes},\
bio={self.bio},\
location={self.location},\
metadata_multihash={self.metadata_multihash},\
creator_node_endpoint={self.creator_node_endpoint},\
updated_at={self.updated_at},\
created_at={self.created_at})>"


class Track(Base):
    __tablename__ = "tracks"

    blockhash = Column(String, ForeignKey("blocks.blockhash"), nullable=False)
    blocknumber = Column(Integer, ForeignKey("blocks.number"), nullable=False)
    track_id = Column(Integer, nullable=False)
    is_current = Column(Boolean, nullable=False)
    is_delete = Column(Boolean, nullable=False)
    owner_id = Column(Integer, nullable=False)
    route_id = Column(String, nullable=False)
    title = Column(Text)
    length = Column(Integer)
    cover_art = Column(String)
    cover_art_sizes = Column(String)
    tags = Column(String)
    genre = Column(String)
    mood = Column(String)
    credits_splits = Column(String)
    remix_of = Column(postgresql.JSONB, nullable=True)
    create_date = Column(String)
    release_date = Column(String)
    file_type = Column(String)
    description = Column(String)
    license = Column(String)
    isrc = Column(String)
    iswc = Column(String)
    track_segments = Column(postgresql.JSONB, nullable=False)
    metadata_multihash = Column(String)
    download = Column(postgresql.JSONB, nullable=True)
    updated_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, nullable=False)
    is_unlisted = Column(Boolean, nullable=False)
    field_visibility = Column(postgresql.JSONB, nullable=True)
    stem_of = Column(postgresql.JSONB, nullable=True)

    # Primary key has to be combo of all 3 is_current/creator_id/blockhash
    PrimaryKeyConstraint(is_current, track_id, blockhash)

    def __repr__(self):
        return (
            f"<Track("
            f"blockhash={self.blockhash},"
            f"blocknumber={self.blocknumber},"
            f"track_id={self.track_id},"
            f"is_current={self.is_current},"
            f"is_delete={self.is_delete},"
            f"owner_id={self.owner_id},"
            f"route_id={self.route_id},"
            f"title={self.title},"
            f"length={self.length},"
            f"cover_art={self.cover_art},"
            f"cover_art_sizes={self.cover_art_sizes},"
            f"tags={self.tags},"
            f"genre={self.genre},"
            f"mood={self.mood},"
            f"credits_splits={self.credits_splits},"
            f"remix_of={self.remix_of},"
            f"create_date={self.create_date},"
            f"release_date={self.release_date},"
            f"file_type={self.file_type},"
            f"description={self.description},"
            f"license={self.license},"
            f"isrc={self.isrc},"
            f"iswc={self.iswc},"
            f"track_segments={self.track_segments},"
            f"metadata_multihash={self.metadata_multihash},"
            f"download={self.download},"
            f"updated_at={self.updated_at},"
            f"created_at={self.created_at},"
            f"stem_of={self.stem_of}"
            ")>"
        )


class Playlist(Base):
    __tablename__ = "playlists"
    blockhash = Column(String, ForeignKey("blocks.blockhash"), nullable=False)
    blocknumber = Column(Integer, ForeignKey("blocks.number"), nullable=False)
    playlist_id = Column(Integer, nullable=False)
    playlist_owner_id = Column(Integer, nullable=False)
    is_album = Column(Boolean, nullable=False)
    is_private = Column(Boolean, nullable=False)
    playlist_name = Column(String)
    playlist_contents = Column(JSONB, nullable=False)
    playlist_image_multihash = Column(String)
    playlist_image_sizes_multihash = Column(String)
    description = Column(String)
    upc = Column(String)
    is_current = Column(Boolean, nullable=False)
    is_delete = Column(Boolean, nullable=False)
    updated_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, nullable=False)

    # Primary key has to be a combination of is_current/playlist_id/playlist_owner_id/blockhash
    PrimaryKeyConstraint(is_current, playlist_id, playlist_owner_id, blockhash)

    def __repr__(self):
        return f"<Playlist(blockhash={self.blockhash},\
blocknumber={self.blocknumber},\
playlist_id={self.playlist_id},\
playlist_owner_id={self.playlist_owner_id},\
is_album={self.is_album},\
is_private={self.is_private},\
playlist_name={self.playlist_name},\
playlist_contents={self.playlist_contents},\
playlist_image_multihash={self.playlist_image_multihash},\
playlist_image_sizes_multihash={self.playlist_image_sizes_multihash},\
description={self.description},\
upc={self.upc}\
is_current={self.is_current},\
is_delete={self.is_delete},\
updated_at={self.updated_at},\
created_at={self.created_at}>"

class RepostType(str, enum.Enum):
    track = 'track'
    playlist = 'playlist'
    album = 'album'


class Repost(Base):
    __tablename__ = "reposts"

    blockhash = Column(String, ForeignKey("blocks.blockhash"), nullable=False)
    blocknumber = Column(Integer, ForeignKey("blocks.number"), nullable=False)
    user_id = Column(Integer, nullable=False)
    repost_item_id = Column(Integer, nullable=False)
    repost_type = Column(Enum(RepostType), nullable=False)
    is_current = Column(Boolean, nullable=False)
    is_delete = Column(Boolean, nullable=False)
    created_at = Column(DateTime, nullable=False)

    PrimaryKeyConstraint(user_id, repost_item_id, repost_type, is_current, blockhash)

    def __repr__(self):
        return f"<Repost(blockhash={self.blockhash},\
blocknumber={self.blocknumber},\
user_id={self.user_id},\
repost_item_id={self.repost_item_id},\
repost_type={self.repost_type},\
is_current={self.is_current},\
is_delete={self.is_delete},\
created_at={self.created_at})>"


class Follow(Base):
    __tablename__ = "follows"

    blockhash = Column(String, ForeignKey("blocks.blockhash"), nullable=False)
    blocknumber = Column(Integer, ForeignKey("blocks.number"), nullable=False)
    follower_user_id = Column(Integer, nullable=False, index=True)
    followee_user_id = Column(Integer, nullable=False, index=True)
    is_current = Column(Boolean, nullable=False)
    is_delete = Column(Boolean, nullable=False)
    created_at = Column(DateTime, nullable=False)

    # Primary key has to be composite key of is_current/follower_user_id/followee_user_id/blockhash
    PrimaryKeyConstraint(is_current, follower_user_id, followee_user_id, blockhash)

    def __repr__(self):
        return f"<Follow(blockhash={self.blockhash},\
blocknumber={self.blocknumber},\
follower_user_id={self.follower_user_id},\
followee_user_id={self.followee_user_id},\
is_current={self.is_current},\
is_delete={self.is_delete},\
created_at={self.created_at}>"


class SaveType(str, enum.Enum):
    track = 'track'
    playlist = 'playlist'
    album = 'album'


class Save(Base):
    __tablename__ = "saves"

    blockhash = Column(String, ForeignKey("blocks.blockhash"), nullable=False)
    blocknumber = Column(Integer, ForeignKey("blocks.number"), nullable=False)
    user_id = Column(Integer, nullable=False)
    save_item_id = Column(Integer, nullable=False)
    save_type = Column(Enum(SaveType), nullable=False)
    created_at = Column(DateTime, nullable=False)
    is_current = Column(Boolean, nullable=False)
    is_delete = Column(Boolean, nullable=False)

    PrimaryKeyConstraint(is_current, user_id, save_item_id, save_type, blockhash)

    def __repr__(self):
        return f"<Save(blockhash={self.blockhash},\
blocknumber={self.blocknumber},\
user_id={self.user_id},\
save_item_id={self.save_item_id},\
created_at={self.created_at},\
save_type={self.save_type},\
is_current={self.is_current},\
is_delete={self.is_delete}>"

class Stem(Base):
    __tablename__ = "stems"

    parent_track_id = Column(Integer, nullable=False, index=False)
    child_track_id = Column(Integer, nullable=False, index=False)
    PrimaryKeyConstraint(parent_track_id, child_track_id)

    def __repr__(self):
        return f"<Remix(parent_track_id={self.parent_track_id},\
            child_track_id={self.child_track_id})"

class Remix(Base):
    __tablename__ = "remixes"

    parent_track_id = Column(Integer, nullable=False, index=False)
    child_track_id = Column(Integer, nullable=False, index=False)
    PrimaryKeyConstraint(parent_track_id, child_track_id)

    def __repr__(self):
        return f"<Remix(parent_track_id={self.parent_track_id},\
            child_track_id={self.child_track_id}>"
