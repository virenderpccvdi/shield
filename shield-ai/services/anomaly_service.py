import numpy as np
import pickle
import os
import logging
from sklearn.ensemble import IsolationForest
from schemas.response import AnomalyResult, RiskLevel

logger = logging.getLogger(__name__)

# Feature order matching model_trainer.py (8 normalized features)
TRAINED_FEATURE_ORDER = [
    'query_count_norm', 'block_rate', 'unique_domains_norm',
    'late_night_ratio', 'social_ratio', 'gaming_ratio',
    'streaming_ratio', 'vpn_ratio',
]

# Legacy feature order (11 raw features) used by default/synthetic model
FEATURE_ORDER = [
    'query_count', 'block_count', 'block_rate', 'unique_domains',
    'adult_queries', 'social_queries', 'gaming_queries',
    'after_hours_queries', 'new_domains', 'hour_of_day', 'day_of_week'
]

MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', 'models', 'anomaly_model.pkl')

_model: IsolationForest | None = None


def _train_default_model() -> IsolationForest:
    """Train a default model on synthetic normal-usage data."""
    logger.info("Training default anomaly model on synthetic data...")
    rng = np.random.default_rng(42)
    n = 2000
    X = np.column_stack([
        rng.integers(10, 200, n),     # query_count
        rng.integers(0, 20, n),       # block_count
        rng.uniform(0, 0.2, n),       # block_rate
        rng.integers(5, 80, n),       # unique_domains
        rng.integers(0, 2, n),        # adult_queries
        rng.integers(0, 15, n),       # social_queries
        rng.integers(0, 10, n),       # gaming_queries
        rng.integers(0, 3, n),        # after_hours_queries
        rng.integers(0, 5, n),        # new_domains
        rng.integers(7, 22, n),       # hour_of_day (school/afternoon hours)
        rng.integers(0, 7, n),        # day_of_week
    ])
    model = IsolationForest(contamination=0.05, random_state=42, n_estimators=100)
    model.fit(X)
    return model


def load_model() -> IsolationForest:
    global _model
    if _model is not None:
        return _model
    if os.path.exists(MODEL_PATH):
        try:
            with open(MODEL_PATH, 'rb') as f:
                data = pickle.load(f)
            # Trainer saves a dict {"model": IsolationForest, ...}
            if isinstance(data, dict):
                _model = data.get("model")
            else:
                _model = data
            if _model is not None:
                logger.info("Anomaly model loaded from disk.")
                return _model
        except Exception as e:
            logger.warning(f"Failed to load model from disk: {e}. Training new model.")
    _model = _train_default_model()
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    with open(MODEL_PATH, 'wb') as f:
        pickle.dump(_model, f)
    logger.info("Default anomaly model trained and saved.")
    return _model


def _normalize_features(features: dict) -> list:
    """Convert raw profile stats to normalized feature vector matching trained model."""
    qc = max(int(features.get('query_count', 0)), 1)
    return [
        min(qc, 500) / 500.0,
        float(features.get('block_rate', 0)) or (int(features.get('block_count', 0)) / qc),
        min(int(features.get('unique_domains', 0)), 200) / 200.0,
        int(features.get('after_hours_queries', 0)) / qc,   # late_night_ratio proxy
        int(features.get('social_queries', 0)) / qc,
        int(features.get('gaming_queries', 0)) / qc,
        0.0,   # streaming_ratio (not in profile stats)
        0.0,   # vpn_ratio (not in profile stats)
    ]


def detect_anomaly(features: dict) -> AnomalyResult:
    model = load_model()
    n_features = model.n_features_in_ if hasattr(model, 'n_features_in_') else 11
    if n_features == 8:
        vec = _normalize_features(features)
    else:
        vec = [features.get(f, 0) for f in FEATURE_ORDER]
    X = np.array([vec])
    score = float(model.decision_function(X)[0])
    is_anomaly = model.predict(X)[0] == -1

    if score < -0.3:
        severity = RiskLevel.HIGH
    elif score < -0.1:
        severity = RiskLevel.MEDIUM
    else:
        severity = RiskLevel.LOW

    return AnomalyResult(is_anomaly=is_anomaly, score=score, severity=severity)


def reload_model(model_data: dict) -> None:
    """Replace the in-memory model with a freshly trained one.

    model_data must have a 'model' key containing an IsolationForest instance.
    The remaining keys (feature_names, trained_at, etc.) are informational.
    """
    global _model
    new_model = model_data.get("model")
    if new_model is None:
        raise ValueError("model_data must contain a 'model' key with a fitted IsolationForest")
    _model = new_model
    logger.info(
        "Anomaly model reloaded in memory. trained_at=%s samples=%s",
        model_data.get("trained_at"),
        model_data.get("training_samples"),
    )


def is_model_loaded() -> bool:
    return _model is not None or os.path.exists(MODEL_PATH)
