"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiFeatures = void 0;
const pagination_1 = require("./pagination");
class ApiFeatures {
    mongooseQuery;
    QueryData;
    constructor(mongooseQuery, QueryData) {
        this.mongooseQuery = mongooseQuery;
        this.QueryData = QueryData;
    }
    pagination() {
        const page = this.QueryData.page ?? 1;
        const size = this.QueryData.size ?? 2;
        const { limit, skip } = (0, pagination_1.paginationFunction)({ page, size });
        this.mongooseQuery = this.mongooseQuery.limit(limit).skip(skip);
        return this;
    }
    sort() {
        if (this.QueryData.sort) {
            this.mongooseQuery = this.mongooseQuery.sort(this.QueryData.sort.replaceAll(",", " "));
        }
        return this;
    }
    select() {
        if (this.QueryData.select) {
            this.mongooseQuery = this.mongooseQuery.select(this.QueryData.select.replaceAll(",", " "));
        }
        return this;
    }
    getQuery() {
        return this.mongooseQuery;
    }
}
exports.ApiFeatures = ApiFeatures;
