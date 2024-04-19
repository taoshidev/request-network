import { ServiceDTO } from "./service.dto";
import { WalletDTO } from "./wallet.dto";
export type ServiceWithWalletDTO = ServiceDTO & Pick<WalletDTO, "publicKey" | "privateKey">;
