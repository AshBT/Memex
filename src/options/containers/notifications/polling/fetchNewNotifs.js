import db from "../../../../pouchdb"
import setUnreadCount from "../../../../util/setUnreadCount"
import updateWBBadge from '../updateWBBadge'
import desktopNotification from './desktopNotification'
import compareArrays from './compareArrays'

// const PouchDB = require('pouchdb');
// PouchDB.plugin(require('pouchdb-upsert'))

// export default function fetchNewNotifs() {
//     setInterval(function() {
//         let url = "https://codepen.io/jobs.json"
//         fetch(url).then(res => res.json()
//         ).then(res => {
//             let newNotes = res.jobs
//             return newNotes
//         }).then(newNotes => {
//             newNotes.forEach(function(element) {
//                 db.put({
//                     "_id": "notif_" + element.hashid,
//                     "MongoId": element.hashid,
//                     "title": element.title,
//                     "body": element.description,
//                     "viewed": false,
//                 })
//             })
//         }).then(
//             setUnreadCount(0)
//         ).then(
//             updateWBBadge(0)
//         ).catch(err => console.error("err", err))
//     }, 1000 * 60 * 60)
// }

// var val = await getMeAPromise();
//  val = await getMeAPromise();

export default async function fetchNewNotifs() {
    
        try {
            let res = await fetch("https://safe-bastion-45672.herokuapp.com/kate.json")
            let foo = await res.json()
            let newNotes = await foo.badges

            compareArrays(newNotes)

            // if newNotes contains notif which is not in pouchdb notifs, then trigger desktopNotifs
            // use filter

            // what is unread count?

            // run setunread count

            // compare the 2, if higher, run desktopNotifs

            newNotes.forEach(function(element) {
                db.put({
                    "_id": "notif_" + element.id,
                    "MongoId": element.id,
                    "title": element.name,
                    "body": element.earned_date,
                    "viewed": false,
                })
            })
            await setUnreadCount()
            await updateWBBadge()
            await console.log("does it work?")
        }  
        catch(err) {
            console.log('Error: ', err.message);
        }
       
}