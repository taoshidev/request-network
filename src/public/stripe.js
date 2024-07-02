(async () => {
  var keyElement = document.getElementById("key");
  var cardElement = document.getElementById("card");
  var serviceNameInput = document.getElementById("service-name-input");
  var serviceRouteInput = document.getElementById("service-route-input");
  var nameInput = document.getElementById("name-input");
  var emailInput = document.getElementById("email-input");
  var priceInput = document.getElementById("price-input");
  var submitBtn = document.getElementById("submit-btn");
  var cardError = document.getElementById("card-error");
  var subscribe = document.getElementById("subscribe");
  var complete = document.getElementById("complete");
  var apiError = document.getElementById("api-error");
  var nameError = document.getElementById("name-error");
  var cardInput = document.getElementById("card-input");
  var subTitle = document.getElementById("sub-title");

  var stripeKey = atob(keyElement.getAttribute("data-key"));
  var apiUrl = atob(keyElement.getAttribute("data-api"));
  var uiApiUrl = keyElement.getAttribute("data-ui-api");
  var redirect = "";

  nameInput.addEventListener("keyup", setNameError);
  nameInput.addEventListener("blur", setNameError);
  document.getElementById("payment-form").addEventListener("submit", enroll);

  let data;
  let params;
  let stripeObj;
  let stripeElements;
  let payPerRequest;

  try {
    params = new Proxy(new URLSearchParams(window.location.search), {
      get: (searchParams, prop) => searchParams.get(prop),
    });
    data = JSON.parse(atob(params.token.split(".")[1]));
    payPerRequest = data.paymentType === "PAY_PER_REQUEST";

    serviceNameInput.value = data.name;
    emailInput.value = data.email;
    priceInput.value = `$${data.price}`;
    serviceRouteInput.value = data.url;
    redirect = data.redirect;
  } catch (e) {
    submitBtn.disabled = true;
    apiError.innerText = "Error: Invalid token.";
  }

  if (!payPerRequest) {
    cardInput.classList.remove("hidden");
  }

  function setNameError() {
    if (nameInput.value) nameError.innerText = "";
    else nameError.innerText = "Name on credit card required.";
  }

  if (Stripe) {
    stripeObj = Stripe(stripeKey);
    let paymentIntent;
    stripeElements = stripeObj.elements();

    try {
      const pi = sessionStorage.getItem("pi");
      if (pi) {
        paymentIntent = JSON.parse(atob(pi));
      }
    } catch (e) {}

    if (payPerRequest) {
      subTitle.innerText = "Pay for Service";
      if (paymentIntent?.data?.amount !== data?.price * 100) {
        const paymentIntentRes = await fetch(
          `${apiUrl}/stripe-payment-intent`,
          {
            method: "POST",
            body: JSON.stringify({ rnToken: params.token }),
            headers: {
              "Content-type": "application/json; charset=UTF-8",
            },
          }
        );
        paymentIntent = await paymentIntentRes.json();

        sessionStorage.setItem(
          "pi",
          btoa(
            JSON.stringify({
              data: {
                client_secret: paymentIntent?.data?.client_secret,
                amount: paymentIntent?.data?.amount,
              },
            })
          )
        );
      }

      stripeElements = stripeObj.elements({
        clientSecret: paymentIntent?.data?.client_secret,
        loader: "auto",
      });
      const payment = stripeElements.create("payment", {});

      payment.mount("#payment");
      return;
    }

    var card = stripeElements.create("card");
    if (card && cardElement) {
      card.mount("#card");
      card.addEventListener("change", cardHandler);
    }
  }

  function cardHandler() {
    cardError.innerText = "";
  }

  async function enroll(e) {
    if (e) e.preventDefault();

    var { email, serviceRoute, name } = Object.fromEntries(
      new FormData(e.target)
    );

    if (email && serviceRoute && (name || payPerRequest)) {
      submitBtn.disabled = true;

      if (payPerRequest) {
        const sResult = await stripeObj.confirmPayment({
          elements: stripeElements,
          redirect: "if_required",
          confirmParams: {
            return_url: `${apiUrl}/subscribe`,
          },
        });

        if (!!sResult?.error) {
          submitBtn.disabled = false;
          return (apiError.innerText =
            "Payment error: " + sResult.error?.message);
        }

        subscribe.classList.remove("open");
        complete.classList.add("open");
        setTimeout(() => {
          sessionStorage.removeItem("pi");
          window.close();
        }, 3000);
      } else {
        if (card._complete) {
          stripeObj.createToken(card, email).then(async ({ token, error }) => {
            if (error) {
              this.submittedChange.emit(false);
            } else {
              var enrollment = {
                rnToken: params.token,
                name,
                email,
                token: token.id,
                lastFour: token.card.last4,
                expMonth: token.card.exp_month,
                expYear: token.card.exp_year,
              };

              sendEnrollment(enrollment, e.target);
            }
          });
        } else cardError.innerText = "Credit card information not correct.";
      }
    } else {
      if (!name) nameError.innerText = "Name on credit card required.";
    }
  }

  function sendEnrollment(enrollment, form) {
    fetch(`${apiUrl}/payment`, {
      method: "POST",
      body: JSON.stringify(enrollment),
      headers: {
        "Content-type": "application/json; charset=UTF-8",
      },
    })
      .then((res) => res.json())
      .then((res) => {
        if (!res.error) {
          subscribe.classList.remove("open");
          complete.classList.add("open");
          if (form) form.reset();
          setTimeout(() => {
            window.close();
            // window.open(`${uiApiUrl}${redirect}`, "_blank");
          }, 3000);
        } else {
          apiError.innerText = "Payment error: " + res.error;
          submitBtn.disabled = false;
        }
      });
  }
})();
