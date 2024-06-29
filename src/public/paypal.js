(() => {
  let params;
  let data;
  let enrollment = {};

  try {
    params = new Proxy(new URLSearchParams(window.location.search), {
      get: (searchParams, prop) => searchParams.get(prop),
    });

    data = JSON.parse(atob(params.token.split(".")[1]));
    enrollment = { rnToken: params.token };
  } catch (e) {
    apiError.innerText = "Error: Invalid token.";
  }

  if (data.paymentType === "SUBSCRIPTION") {
    paypal
      .Buttons({
        style: {
          shape: "rect",
          color: "blue", // change the default color of the buttons
          layout: "vertical", //default value. Can be changed to horizontal
        },
        async createSubscription(data, actions) {
          try {
            const response = await fetch(`/paypal-subscriptions`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ rnToken: enrollment?.rnToken }),
            });

            const order = await response.json();

            if (order?.data?.payPalPlanId) {
              return actions.subscription.create({
                plan_id: order?.data?.payPalPlanId, // Creates the subscription
              });
            }

            const errorDetail = orderData?.details?.[0];
            const errorMessage = errorDetail
              ? `${errorDetail.issue} ${errorDetail.description} (${orderData.debug_id})`
              : JSON.stringify(orderData);

            throw new Error(errorMessage);
          } catch (error) {
            resultMessage(
              `Could not initiate PayPal Checkout...<br><br>${error}`
            );
          }
        },
        async onApprove(data, actions) {
          try {
            // (3) Successful transaction -> Show confirmation or thank you message
            // Or go to another URL:  actions.redirect('thank_you.html');

            resultMessage(
              "You have successfully subscribed to " + data.subscriptionID
            );
            const response = await fetch(`/paypal-subscriptions/activate`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(
                Object.assign({}, data, { rnToken: enrollment?.rnToken })
              ),
            });

            const activateData = await response.json();

            if (!activateData?.error) {
              resultMessage(
                "You have successfully activated your subscription."
              );
            } else {
              resultMessage("Error activating your endpoint.");
            }

            setTimeout(() => {
              window.close();
            }, 3000);
          } catch (error) {
            resultMessage(
              `Sorry, your transaction could not be processed...<br><br>${error}`
            );
          }
        },
      })
      .render("#paypal-button-container");
  } else {
    paypal
      .Buttons({
        style: {
          shape: "rect",
          color: "gold", // change the default color of the buttons
          layout: "vertical", //default value. Can be changed to horizontal
        },
        async createOrder() {
          try {
            const response = await fetch("/paypal-orders", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              // use the "body" param to optionally pass additional order information
              // like product ids and quantities
              body: JSON.stringify(enrollment),
            });

            const orderData = await response.json();

            if (orderData.id) {
              return orderData.id;
            } else {
              const errorDetail = orderData?.details?.[0];
              const errorMessage = errorDetail
                ? `${errorDetail.issue} ${errorDetail.description} (${orderData.debug_id})`
                : JSON.stringify(orderData);

              throw new Error(errorMessage);
            }
          } catch (error) {
            resultMessage(
              `Could not initiate PayPal Checkout...<br><br>${error}`
            );
          }
        },
        async onApprove(data, actions) {
          try {
            const response = await fetch(
              `/paypal-orders/${data.orderID}/capture`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ rnToken: enrollment?.rnToken }),
              }
            );

            const orderData = await response.json();
            // Three cases to handle:
            //   (1) Recoverable INSTRUMENT_DECLINED -> call actions.restart()
            //   (2) Other non-recoverable errors -> Show a failure message
            //   (3) Successful transaction -> Show confirmation or thank you message

            const errorDetail = orderData?.details?.[0];

            if (errorDetail?.issue === "INSTRUMENT_DECLINED") {
              // (1) Recoverable INSTRUMENT_DECLINED -> call actions.restart()
              // recoverable state, per https://developer.paypal.com/docs/checkout/standard/customize/handle-funding-failures/
              return actions.restart();
            } else if (errorDetail) {
              // (2) Other non-recoverable errors -> Show a failure message
              throw new Error(
                `${errorDetail.description} (${orderData.debug_id})`
              );
            } else if (!orderData.purchase_units) {
              throw new Error(JSON.stringify(orderData));
            } else {
              // (3) Successful transaction -> Show confirmation or thank you message
              // Or go to another URL:  actions.redirect('thank_you.html');
              const transaction =
                orderData?.purchase_units?.[0]?.payments?.captures?.[0] ||
                orderData?.purchase_units?.[0]?.payments?.authorizations?.[0];
              resultMessage(
                `Payment ${transaction.status}:<br />${transaction.id}`
              );
              setTimeout(() => {
                window.close();
              }, 3000);
            }
          } catch (error) {
            console.error(error);
            resultMessage(
              `Sorry, your transaction could not be processed...<br><br>${error}`
            );
          }
        },
      })
      .render("#paypal-button-container");
  }

  // Example function to show a result to the user. Your site's UI library can be used instead.
  function resultMessage(message) {
    const container = document.querySelector("#result-message");
    container.innerHTML = message;
  }
})();
