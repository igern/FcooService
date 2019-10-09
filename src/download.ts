const fs = require("fs");
const NetCDFReader = require("netcdfjs");
import cluster from 'cluster'
import { cpus } from 'os'
import http from 'http'
import {MongoClient, Db} from 'mongodb'
import assert from 'assert'

const numCPUs: number = cpus().length;
// Database
const dbUrl = "mongodb://localhost:27017";
const dbName = "fcoodb";
const client = new MongoClient(dbUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
// Data configs
const dataUrl =
  "http://wms.fcoo.dk/webmap/FCOO/GETM/idk-600m_3D-velocities_surface_1h.DK600-v007C.nc";
const dest = "data.nc";



const download = async function(url, dest, cb) {
  var file = fs.createWriteStream(dest);
  var request = http.get(url, function(response) {
    response.pipe(file);
    file.on("finish", function() {
      file.close(cb);
    });
  });
};

const insertVelocityData = async function(db: Db, callback: () => void) {
  console.log("reading data");
  const data = fs.readFileSync("data.nc");
  var reader = new NetCDFReader(data); // read the header
  let date : any = new Date(reader.variables[3].attributes[1].value)
  let timestamp = Math.floor(date / 1000);

  // remove all collections that will be overwritten.

  let newCollectionNames: string[] = [];
  for(const time of reader.getDataVariable("time")) {
    newCollectionNames.push(`${timestamp + time}`)
  }

  await db.collections().then(async (collections) => {
    for (const collection of collections) {
      if(newCollectionNames.includes(collection.collectionName)) {
        db.dropCollection(collection.collectionName)
        console.log(`dropped collection: ${collection.collectionName}`);
      }
    }
  });
  for (const time of reader.getDataVariable("time")) {
    await newFunction(timestamp, time, db, reader);
  }
  callback();
};

const calculateMagnitude = (x, y) => {
  return Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
};

const calculateDirection = (x, y) => {
  let degrees = Math.atan(x / y) * (Math.PI / 180);
  if (x > 0 && y < 0) {
    degrees += 180;
  } else if (x < 0 && y < 0) {
    degrees = Math.abs(degrees) + 180;
  } else if (x < 0 && y > 0) {
    degrees += 360;
  } else {
    degrees = Math.abs(degrees);
  }
  return degrees;
};

download(dataUrl, dest, () => {
  console.log("Done downloading data");
  client.connect(function(err) {
    assert.equal(null, err);
    console.log("Connected successfully to server");
  
    const db: Db = client.db(dbName);
  
    insertVelocityData(db, function() {
      client.close();
    });
  });
})

async function newFunction(timestamp: number, time: any, db: Db, reader: any) {
  let collectionName = `${timestamp + time}`;
  let documents = [];
  let collection = db.collection(collectionName);
  console.log(`Creating collection with name: ${collectionName}`);
  collection.createIndex({ location: "2dsphere" });
  let dataChunkUU = reader.getDataVariable("uu")[time / 3600];
  let dataChunkVV = reader.getDataVariable("vv")[time / 3600];
  let index = 0;
  for (let lat = 0; lat < reader.getDataVariable("latc").length; lat++) {
    for (let lon = 0; lon < reader.getDataVariable("lonc").length; lon++) {
      let xVel = dataChunkUU[index];
      let yVel = dataChunkVV[index];
      if (xVel > -1000 && yVel > -1000) {
        let mag = calculateMagnitude(xVel, yVel);
        let dir = calculateDirection(xVel, yVel);
        documents.push({
          xVelocity: xVel,
          yVelocity: yVel,
          magnitude: mag,
          direction: dir,
          location: {
            type: "Point",
            coordinates: [
              reader.getDataVariable("latc")[lat],
              reader.getDataVariable("lonc")[lon]
            ]
          }
        });
      }
      index++;
    }
  }
  console.log("Done with creating documents");
  await collection.insertMany(documents).then(() => {
    console.log("Done with inserting documents");
  });
}
  