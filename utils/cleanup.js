const Conversation = require("../models/Conversation");

function cleanUpConversations() {
  setInterval(
    async () => {
      const now = new Date();
      const emptyThreshold = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const oldThreshold = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

      try {
        // Delete empty conversations older than emptyThreshold
        const deletedEmpty = await Conversation.deleteMany({
          date_created: { $lt: emptyThreshold },
          messages: [],
        });
        if (deletedEmpty.deletedCount > 0) {
          console.log(
            `Deleted ${deletedEmpty.deletedCount} empty conversation(s).`,
          );
        }

        // Delete conversations not updated within oldThreshold
        const deletedOld = await Conversation.deleteMany({
          last_updated: { $lt: oldThreshold },
        });
        if (deletedOld.deletedCount > 0) {
          console.log(
            `Deleted ${deletedOld.deletedCount} old conversation(s).`,
          );
        }
      } catch (error) {
        console.error("Error deleting conversations:", error);
      }
    },
    1000 * 60 * 2,
  ); // Run every 2 minutes
}

module.exports = { cleanUpConversations };
