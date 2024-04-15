import Encryption from "../utils/encryption";
import { customType } from "drizzle-orm/pg-core";

export const bytea = customType<{
  data: string;
  notNull: false;
  default: false;
}>({
  dataType: () => "bytea",
  toDriver: (value) => {
    const bufferValue = Buffer.isBuffer(value)
      ? value
      : Buffer.from(value, "utf8");
    return Encryption.encrypt(bufferValue);
  },
  fromDriver: (value) => {
    const decryptedBuffer = Encryption.decrypt(value as Buffer);
    return decryptedBuffer.toString("utf8");
  },
});
