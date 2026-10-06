class AIModelError(Exception):
    pass


class InsufficientDataError(AIModelError, ValueError):
    pass


class ModelNotTrainedError(AIModelError, RuntimeError):
    pass
