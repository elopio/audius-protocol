# Setup.py allows audius-discovery-provider as a redistributable package
# Currently, the repository is not configured as such but may be moving forward
# https://caremad.io/posts/2013/07/setup-vs-requirement/
import uuid
from setuptools import setup, find_packages
from pip._internal.req import parse_requirements

install_reqs = parse_requirements("requirements.txt", session=uuid.uuid1())
requirements = [str(ir.req) for ir in install_reqs]

config = {
    "description": "Audius Discovery Provider",
    "author": "Hareesh Nagaraj",
    "url": "",
    "download_url": "",
    "author_email": "",
    "version": "0.1",
    "install_requires": requirements,
    "packages": find_packages(),
    "scripts": [],
    "name": "audius_discovery_provider",
}

setup(**config)
