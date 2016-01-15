#!/bin/sh

# The ampm config file to load, relative to the path of ampm.
CONFIGFILE=samples/web/config.json

# The version of node to check for.
TESTEDNODE=v4.2.4

# Make sure node is installed.
CURRENTNODE=$(node -v)
if [ "$TESTEDNODE" != "$CURRENTNODE" ]; then 
    echo "You need to install nodejs $TESTEDNODE. Go to nodejs.org." 
    exit 1
fi;

# Make sure nodemon is installed.
NODEMON=$(which nodemon)
if [ "$NODEMON" = "" ]; then
	echo "You need to install nodemon. Run \"sudo npm install -g nodemon\"."
	exit 1
fi;

# Install server dependencies.
cd server
npm install
cd ..

# Start ampm, watch the config.json file for changes.
cd ../../
npm install
RESTARTFILE=restart.json
nodemon \
	--verbose \
	--watch $CONFIGFILE \
	--watch $RESTARTFILE \
	--watch . \
	--ignore logs \
	--ignore state.json \
	server.js $CONFIGFILE $AMPMMODE
