# DigitalOmstilling
This repository contains a node project with the name FcooService. It contains two services, a service to download current data for the inner waters of denmark from the fcoo website and store it into a mongodb database. The other service exposes a service to POST /api that expects a json object with begin and endtime in epoch and 4 gps points to form a geofence. The path will then return all the current data stored in that timeframe and geofence. 
# How to use
Make sure you have docker and docker-compose installed
- Download the repository and go to the root folder
- run: docker-compose up

The service will take 2-5 minutes to startup the mongodb and download the fcoo data. Afterwards the POST /api will be exposed to port 3001. 
The fcoo data download will happen every 24 hours.


