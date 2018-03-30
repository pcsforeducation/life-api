// Description:
//   val-mongodb-brain
//   support for MongoDB
//
// Dependencies:
//   "mongodb": "*"
//   "lodash" : "*"
//
// Configuration:
//   MONGODB_URL or 'mongodb://localhost/hubot-brain'
//
// Author:
//   Josh Gachnang <josh@servercobra.com>

// TODO get types
const Firestore = require("@google-cloud/firestore");
import * as _ from "lodash";

import Robot from "./robot";
import User from "./user";
import {EventEmitter} from "events";

const GLOBAL_KEY = "GLOBAL";

export default class DB {
  robot: Robot;
  db: any;

  constructor(robot: Robot) {
    this.robot = robot;

    let projectId = robot.config.get("FIREBASE_PROJECT_ID");

    robot.logger.debug(`[db] connecting to firestore project: ${projectId}`);

    this.db = new Firestore({
      projectId: projectId,
      keyFilename: "firebase.json",
    });
  }

  // By default, everything is stored per user.
  private getKey(userId, key) {
    if (userId === GLOBAL_KEY) {
      return `GLOBAL/${key}`;
    } else {
      return `${userId}/${key}`;
    }
  }

  set(userId, key, value) {
    console.log("SETTING", this.getKey(userId, key));
    console.log("TO VALUE", value);
    return this.db.doc(this.getKey(userId, key)).set(value);
  }

  async get(userId, key): Promise<any[] | any> {
    let docs = [];
    let all = await this.db.doc(this.getKey(userId, key)).get();
    if (all.forEach) {
      console.log("GET ALL", all);
      all.forEach((doc) => docs.push(doc.data()));
      return docs;
    } else {
      return all.data();
    }
  }

  // Update or create new user
  public async updateUser(user: User) {
    if (!user || !user.id) {
      this.robot.logger.warn(`[brain] Cannot update undefined user: ${user}`);
      return;
    }
    let userList = await this.get(GLOBAL_KEY, "users");
    let users = _.keyBy(userList, "id");
    if (!users) {
      users = {};
    }
    // Should merge the user here rather than just setting it. This just clobbers them.
    users[user.id] = user;
    await this.set(GLOBAL_KEY, "users", users);
  }

  public async getUsers() {
    return await this.get(GLOBAL_KEY, "users");
  }

  // Categories
  //
  // This is a simple way to manage a series of grouped items for the bot, dynamically.
  // A good example is a bot that replies to a certain phrase with a random gif. If the list of gifs
  // is hard coded in the plugin, it will get boring eventually. This lets the plugin register a
  // list of default gifs, then a user can add more gifs to the category, and when a phrase triggers
  // the plugin, it fetchs a random item. The items are stored as strings, but could be response
  // phrases, image links, or serialized objects.
  CATEGORY_KEY = "categories";
  public async listCategories(): Promise<string[]> {
    let allItems = (await this.get(GLOBAL_KEY, this.CATEGORY_KEY)) || {};
    return Object.keys(allItems);
  }

  public async addItemToCategory(category: string, item: string) {
    let allItems = (await this.get(GLOBAL_KEY, this.CATEGORY_KEY)) || {};
    if (!allItems[category]) {
      allItems[category] = [];
    }
    allItems[category].push(item);
    await this.set(GLOBAL_KEY, this.CATEGORY_KEY, allItems);
  }

  public async removeItemAtIndexInCategory(category: string, index: number) {
    let allItems = (await this.get(GLOBAL_KEY, this.CATEGORY_KEY)) || {};
    let items = allItems[category] || [];
    items.splice(index, 1);
    allItems[category] = items;
    await this.set(GLOBAL_KEY, this.CATEGORY_KEY, allItems);
  }

  public async getRandomItemFromCategory(category: string): Promise<string> {
    let combined = await this.listItemsInCategory(category);
    return combined[Math.floor(Math.random() * combined.length)];
  }

  public async listItemsInCategory(category: string): Promise<string[]> {
    let allItems = (await this.get(GLOBAL_KEY, this.CATEGORY_KEY)) || {};
    let items = allItems[category] || [];
    return items;
  }

  public async registerDefaultsForCateogry(category: string, items: string[]) {
    let allItems = (await this.get(GLOBAL_KEY, this.CATEGORY_KEY)) || {};
    console.log("all items", allItems);
    let existingItems = allItems[category] || [];
    if (existingItems.length > 0) {
      return;
    }
    this.robot.logger.debug(`[brain] Loading defaults for category ${category}`);
    allItems[category] = items;
    this.set(GLOBAL_KEY, this.CATEGORY_KEY, allItems);
  }
}

// // Provide a non-async, backwards compat brain that wraps DB.
// export class FirebaseBrain extends EventEmitter {
//   robot: Robot;
//   data: any;

//   constructor(robot) {
//     super();
//     this.robot = robot;
//     this.data = {
//       users: {}, // id: User
//       _private: {},
//     };
//   }

//   public set(key, value) {
//     let pair: any;
//     if (key === Object(key)) {
//       pair = key;
//     } else {
//       pair = {};
//       pair[key] = value;
//     }

//     _.extend(this.data._private, pair);
//     this.emit("loaded", this.data);
//     return this;
//   }

//   public get(key) {
//     return this.data._private[key] != null ? this.data._private[key] : null;
//   }

//   public mergeData(data) {
//     if (data) {
//       _.extend(this.data, data);
//     }
//     this.robot.logger.info(`[brain] Merged data, current keys: ${Object.keys(this.data._private)}`);
//     this.emit("loaded", this.data);
//   }

//   public save() {}

//   public close() {}

//   public setAutoSave(enabled) {}

//   public resetSaveInterval(seconds) {}
// }
