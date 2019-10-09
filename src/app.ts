import express from 'express';
import bodyparser from 'body-parser'
import { PolygonalGeofence } from './geofence'
import { MongoClient } from 'mongodb'
import assert = require('assert');
import {LatLon} from './latlon';

const dbUrl = process.env.databasePath || "mongodb://localhost:27017"
const dbName = process.env.dbName || "fcoodb"
const client = new MongoClient(dbUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})

const app = express();
app.use(bodyparser.urlencoded({ extended: false }))
app.use(bodyparser.json())

const port = process.env.port || "3001";

app.listen(port, err => {
  if (err) {
    return console.error(err);
  }
  return console.log(`server is listening on ${port}`);
});

app.post('/api', function(req, res) {
    let input = req.body;

    let coordinateList = [];
    for(let i = 0; i < input.geofence.latlonList.length; i++) {
        let point = input.geofence.latlonList[i];
        coordinateList.push(new LatLon(point.lat, point.lon))
    }

    let geofence;
    switch(input.geofence.type) {
        case "polygon":
            geofence = new PolygonalGeofence(input.beginTime, input.endTime, coordinateList)
            break;
        default:
            res.send("bad geofence type")
            break;
    }


    client.connect(async function(err) {
        assert.equal(null, err);

        const db = client.db(dbName)
        geofence.handle(db).then((result) => {
            client.close();
            if(result.length < 1) {
                res.status(404).send("no data")
            } else {
                res.status(200).send(result)
            }
        })
    })
})
