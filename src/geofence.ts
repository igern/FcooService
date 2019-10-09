import { Db, Collection } from 'mongodb'
import assert = require('assert');
import { LatLon } from './latlon'

export abstract class Geofence {
    constructor(public beginTime: number, public endTime: number, public vertices: Array<LatLon>) {

    }

    public async handle(db: Db): Promise<Array<any>> {
        let polygon = [];
        for (let i = 0; i < this.vertices.length; i++) {
            polygon.push([this.vertices[i].lat, this.vertices[i].lon])
        }
        let collectionNames = await this.getCollections(db, this.beginTime, this.endTime)
        let data = []
        for(let i = 0; i < collectionNames.length; i++) {
            let VelData = await this.makeRequest(db, collectionNames[i], polygon)
            data.push(VelData)
        }
        return data
    }

    abstract makeRequest(db: Db, collectionName: string, vertices)

    private async getCollections(db: Db, beginTime: number, endTime: number): Promise<Array<string>> {
        let collections = await db.collections()
        let filteredCollection = collections.map(function (collection) {
            return Number(collection.collectionName)
        }).filter(function (number) {
            return number > beginTime && number < endTime
        }).map(function (filteredValue) {
            return filteredValue.toString()
        })
        return filteredCollection
    }
}

export class PolygonalGeofence extends Geofence {

    constructor(public beginTime: number, public endTime: number, public vertices: Array<LatLon>) {
        super(beginTime, endTime, vertices)
    }
    makeRequest(db: Db, collectionName: string, vertices): Promise<Object> {

        return new Promise((resolve, reject) => {
            db.collection(collectionName).find({
                location: {
                    $geoWithin: {
                        $polygon: vertices
                    }
                }
            }).toArray(function (err, docs) {
                assert.equal(err, null);
                resolve({
                    timestamp: collectionName,
                    data: docs
                })

            })
        })
    }

}

