const fs = require("fs");
const NetCDFReader = require("netcdfjs");

const data = fs.readFileSync('idk-600m_3D-velocities_surface_1h.DK600-v007C.nc')

var reader = new NetCDFReader(data);
var time = reader.getDataVariable('time')

console.log(time.getUnitsString())