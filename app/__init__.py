import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from .config import Config

# SQLAlchemy instance

db = SQLAlchemy()


def create_app() -> Flask:
    app = Flask(__name__, static_folder="static", template_folder="templates")
    app.config.from_object(Config())

    db.init_app(app)

    with app.app_context():
        from . import models  # noqa: F401
        db.create_all()

        from .routes import bp as main_bp
        app.register_blueprint(main_bp)

    return app