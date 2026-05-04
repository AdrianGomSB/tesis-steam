import { probarConexion } from "../config/db";

probarConexion()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error al conectar con la base de datos:");
    console.error(error);
    process.exit(1);
  });
