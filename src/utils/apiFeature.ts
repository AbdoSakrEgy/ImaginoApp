import { Document, Query } from "mongoose";
import { paginationFunction } from "./pagination";

interface QueryData {
  page?: number;
  size?: number;
  sort?: string;
  select?: string;
}

export class ApiFeatures<Feature extends Document> {
  private mongooseQuery: Query<Feature[], Feature>;
  private QueryData: QueryData;

  constructor(mongooseQuery: Query<Feature[], Feature>, QueryData: QueryData) {
    this.mongooseQuery = mongooseQuery;
    this.QueryData = QueryData;
  }

  pagination(): this {
    const page = this.QueryData.page ?? 1;
    const size = this.QueryData.size ?? 2;

    const { limit, skip } = paginationFunction({ page, size });
    this.mongooseQuery = this.mongooseQuery.limit(limit).skip(skip);
    return this;
  }

  sort(): this {
    if (this.QueryData.sort) {
      this.mongooseQuery = this.mongooseQuery.sort(
        this.QueryData.sort.replaceAll(",", " ")
      );
    }
    return this;
  }

  select(): this {
    if (this.QueryData.select) {
      this.mongooseQuery = this.mongooseQuery.select(
        this.QueryData.select.replaceAll(",", " ")
      );
    }
    return this;
  }

  getQuery(): Query<Feature[], Feature> {
    return this.mongooseQuery;
  }
}
