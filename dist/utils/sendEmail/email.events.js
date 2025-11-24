"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailEvent = void 0;
const events_1 = require("events");
const send_email_1 = require("./send.email");
exports.emailEvent = new events_1.EventEmitter();
exports.emailEvent.on("sendEmail", async (emailStructure) => {
    const { isEmailSended, info } = await (0, send_email_1.sendEmail)({
        to: emailStructure.to,
        subject: emailStructure.subject,
        html: emailStructure.html,
    });
    // if (!isEmailSended) {
    //   throw new ApplicationExpection("Error while sending email", 400);
    // }
    // Using EventEmmitter to handle email sending is so bad
    // 1- The error is thrown inside an EventEmitter listener, which runs outside Express’s request/response cycle
    // 1- You can't use condition on emmiter to stop code if error happend
});
