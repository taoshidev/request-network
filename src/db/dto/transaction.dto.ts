import { BaseDTO } from "./base.dto.js";

export class TransactionDTO extends BaseDTO {
  serviceId?: string;
  transactionType?: "deposit" | "withdrawal";
  walletAddress?: string; // Address of the wallet involved in the transaction
  transactionHash?: string;
  fromAddress?: string;
  toAddress?: string;
  amount?: string;
  totalDeposits?: string | number;
  blockNumber?: number;
  confirmed?: boolean;
  tokenAddress?: string; // Address of the token (if ERC-20 transaction)
  meta?: any;

  constructor(data: Partial<TransactionDTO>) {
    super(data);
    Object.assign(this, data);
  }
}
