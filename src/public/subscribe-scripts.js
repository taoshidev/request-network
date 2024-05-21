(() => {
  var keyElement = document.getElementById("key");
  var cardElement = document.getElementById("card");
  var serviceNameInput = document.getElementById("service-name-input");
  var serviceRouteInput = document.getElementById("service-route-input");
  var emailInput = document.getElementById("email-input");
  var submitBtn = document.getElementById("submit-btn");
  var cardError = document.getElementById("card-error");
  var subscribe = document.getElementById("subscribe");
  var complete = document.getElementById("complete");
  var emailError = document.getElementById("email-error");
  var serviceRouteError = document.getElementById("service-route-error");
  var apiError = document.getElementById("api-error");

  var stripeKey = atob(keyElement.getAttribute("data-key"));
  var apiUrl = atob(keyElement.getAttribute("data-api"));
  var focus = "";

  document.getElementById("payment-form").addEventListener("submit", enroll);
  document.addEventListener("focusin", (e) => (focus = e.target.name));
  document.addEventListener("focusout", (e) => {
    e.target.value = (e.target.value || "").trim();
    focus = "";

    if (e.target.name === "email" && !e.target.value)
      emailError.innerText = "Email required.";
    if (e.target.name === "serviceRoute" && !e.target.value)
      serviceRouteError.innerText = "Service Route required.";
  });
  document.addEventListener("keydown", (e) => {
    if (focus === "email") emailError.innerText = "";
  });

  var data;
  var params;
  try {
    params = new Proxy(new URLSearchParams(window.location.search), {
      get: (searchParams, prop) => searchParams.get(prop),
    });

    data = JSON.parse(atob(params.token.split(".")[1]));
    serviceNameInput.value = data.name;
    emailInput.value = data.email;
    serviceRouteInput.value = data.url;
  } catch (e) {
    apiError.innerText = "Error: Invalid token.";
  }

  if (Stripe) {
    var stripeObj = Stripe(stripeKey);
    var stripeElements = stripeObj.elements();
    var card = stripeElements.create("card");

    if (card && cardElement) {
      card.mount("#card");
      card.addEventListener("change", cardHandler);
    }
  }

  function cardHandler() {
    cardError.innerText = "";
  }

  function enroll(e) {
    if (e) e.preventDefault();

    var { email, serviceRoute } = Object.fromEntries(
      new FormData(e.target)
    );

    if (card._complete && email && serviceRoute) {
      submitBtn.disabled = true;
      stripeObj.createToken(card, email).then(async ({ token, error }) => {

        if (error) {
          this.submittedChange.emit(false);
        } else {
          var enrollment = {
            rnToken: params.token,
            email,
            token: token.id,
            lastFour: token.card.last4,
            expMonth: token.card.exp_month,
            expYear: token.card.exp_year,
          };

          sendEnrollment(enrollment, e.target);
        }
      });
    } else {
      if (!card._complete)
        cardError.innerText = "Credit card information not correct.";
      if (!email) emailError.innerText = "Email required.";
      if (!serviceRoute)
        serviceRouteError.innerText = "Service Route required.";
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
          form.reset();
        } else {
          apiError.innerText = "Payment error: " + res.error;
          submitBtn.disabled = false;
        }
      });
  }
})();
