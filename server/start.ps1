# Ideally, this would:
# Install git (and add to path) https://msysgit.googlecode.com/files/Git-1.8.4-preview20130916.exe
# Install node (and add to path) http://nodejs.org/dist/v0.10.22/x64/node-v0.10.22-x64.msi

# Install any node modules
npm install -g supervisor
npm install

# https://github.com/isaacs/node-supervisor
supervisor -n error -i view -q server.js
