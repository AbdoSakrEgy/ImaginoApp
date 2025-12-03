"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paginationFunction = void 0;
const paginationFunction = ({ page = 1, size = 2, }) => {
    if (page < 1)
        page = 1;
    if (size < 1)
        size = 2;
    const limit = size;
    const skip = (page - 1) * size;
    return { limit, skip };
};
exports.paginationFunction = paginationFunction;
