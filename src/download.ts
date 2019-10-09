const fs = require("fs");
const NetCDFReader = require("netcdfjs");
const http = require("http");
const MongoClient = require("mongodb").MongoClient;
const assert = require("assert");

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

const insertVelocityData = async function(db, callback) {
  console.log("reading data");
  const data = fs.readFileSync("data.nc");
  var reader = new NetCDFReader(data); // read the header
  let date : any = new Date(reader.variables[3].attributes[1].value)

  let timestamp = Math.floor(date / 1000);
  for (let time = 0; time < reader.getDataVariable("time").length; time++) {
    let collectionName = `${timestamp + time * 3600}`;
    let documents = [];
    await db.collections().then(async collections => {
      for (let i = collections.length - 1; i >= 0; i--) {
        if (collections[i].collectionName == collectionName) {
          await db.dropCollection(collectionName);
          console.log("dropped collection");
        }
      }
    });
    console.log(`Creating collection ${time + 1}`);
    let collection = db.collection(collectionName);
    await collection.createIndex({ location: "2dsphere" });
    let dataChunkUU = reader.getDataVariable("uu")[time];
    let dataChunkVV = reader.getDataVariable("vv")[time];
    let index = 0;
    for (let lat = 0; lat < reader.getDataVariable("latc").length; lat++) {
      for (let lon = 0; lon < reader.getDataVariable("lonc").length; lon++) {
        let xVel = dataChunkUU[index];
        let yVel = dataChunkVV[index];
        let mag = calculateMagnitude(xVel, yVel);
        let dir = calculateDirection(xVel, yVel);
        if (xVel > -1000 && yVel > -1000) {
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
    await collection.insertMany(documents);
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
  
    const db = client.db(dbName);
  
    insertVelocityData(db, function() {
      client.close();
    });
  });
})
  