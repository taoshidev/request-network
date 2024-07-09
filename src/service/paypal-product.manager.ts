import { paypalProducts } from "../db/schema";
import DatabaseWrapper from "../core/database.wrapper";
import { PayPalProductDTO } from "../db/dto/paypal-product.dto";

export default class PaypalProductManager extends DatabaseWrapper<PayPalProductDTO> {
  constructor() {
    super(paypalProducts);
  }
}
