(() => {
  var keyElement = document.getElementById("key");
  var cardElement = document.getElementById("card");
  var cardError = document.getElementById("card-error");
  var emailError = document.getElementById("email-error");

  var stripeKey = atob(keyElement.getAttribute("data-key"));
  var apiUrl = atob(keyElement.getAttribute("data-api"));

  document.getElementById("payment-form").addEventListener("submit", enroll);

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
    var { email, serviceId, serviceName } = Object.fromEntries(
      new FormData(e.target)
    );

    if (card._complete) {
      stripeObj.createToken(card, email).then(async ({ token, error }) => {
        if (error) {
          this.submittedChange.emit(false);
        } else {
          console.log(token);
          var enrollment = {
            serviceId: serviceId,
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
      cardError.innerText = "Credit card information not correct.";
    }
  }

  function sendEnrollment(enrollment, form) {
    fetch(`${apiUrl}/payment`, {
      method: "POST",
      body: JSON.stringify(enrollment),
      headers: {
        "Content-type": "application/json; charset=UTF-8",
      },
    }).then((res) => {
      form.reset();
    });
  }
})();
