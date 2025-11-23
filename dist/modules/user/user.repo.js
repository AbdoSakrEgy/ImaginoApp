"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRepo = void 0;
const db_repo_1 = require("../../DB/repos/db.repo");
const user_model_1 = require("./user.model");
class UserRepo extends db_repo_1.DBRepo {
    model;
    constructor(model = user_model_1.UserModel) {
        super(model);
        this.model = model;
    }
    findByEmail = async ({ email, projection, options, }) => {
        const doc = await this.model.findOne({ email }, projection, options);
        return doc;
    };
}
exports.UserRepo = UserRepo;
