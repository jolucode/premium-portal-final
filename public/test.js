const mongoose = require("mongoose");

const uri = "mongodb://root:ww12Fijo@ac-05g2uac-shard-00-00.tla3seo.mongodb.net:27017,ac-05g2uac-shard-00-01.tla3seo.mongodb.net:27017,ac-05g2uac-shard-00-02.tla3seo.mongodb.net:27017/portalventura?ssl=true&replicaSet=atlas-nofi1s-shard-0&authSource=admin&retryWrites=true&w=majority";

async function main() {
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000
    });
    console.log("✅ Connected to MongoDB");
    console.log("Base actual:", mongoose.connection.name);
    await mongoose.connection.close();
    console.log("✅ Conexión cerrada");
  } catch (error) {
    console.error("❌ Error al conectar:");
    console.error(error);
  }
}

main();