import os
from datetime import timedelta

from flask import Flask, render_template, session, redirect, url_for

from models import db
from routes_admin import admin_bp
from routes_customer import customer_bp


def create_app() -> Flask:
    app = Flask(__name__, template_folder="templates", static_folder="static")

    # Base config
    app.config.from_object("config.Config")
    app.permanent_session_lifetime = timedelta(hours=8)

    # Initialize database
    db.init_app(app)

    # Register blueprints
    app.register_blueprint(admin_bp)
    app.register_blueprint(customer_bp)

    @app.route("/")
    def index():
        # Clear any stale session on landing
        session.pop("is_admin", None)
        session.pop("customer_id", None)
        session.pop("account_id", None)
        return render_template("index.html")

    @app.errorhandler(404)
    def not_found(_e):
        return render_template("base.html", content_title="Not Found", content_body="The page you requested was not found."), 404

    return app


if __name__ == "__main__":
    flask_app = create_app()
    with flask_app.app_context():
        # Create database tables if not exist
        from models import Customer, Account, Transaction, LoginAttempt, FraudAlert  # noqa: F401
        db.create_all()

    port = int(os.environ.get("PORT", 5000))
    flask_app.run(host="0.0.0.0", port=port, debug=True)

