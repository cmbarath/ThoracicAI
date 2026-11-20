"""Service for parsing and serving official model evaluation metrics and artifacts."""

import csv
from pathlib import Path
from typing import Any, Dict, List
from ..config import WORKSPACE_DIR, BASE_DIR
from ..schemas import (
    AllMetricsResponse,
    ClassificationReportRow,
    ConfusionMatrixData,
    DatasetMetrics
)


def _find_path(rel_workspace: str, rel_backend: str) -> Path:
    p1 = WORKSPACE_DIR / rel_workspace
    if p1.exists():
        return p1
    p2 = BASE_DIR.parent / rel_workspace
    if p2.exists():
        return p2
    return BASE_DIR / rel_backend


def _parse_csv_dicts(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        return []
    rows = []
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            parsed = {}
            for k, v in row.items():
                if v is None:
                    continue
                k_clean = k.strip()
                try:
                    if "." in v:
                        parsed[k_clean] = float(v)
                    else:
                        parsed[k_clean] = int(v)
                except ValueError:
                    parsed[k_clean] = v.strip()
            rows.append(parsed)
    return rows


def _parse_confusion_matrix(path: Path) -> ConfusionMatrixData:
    if not path.exists():
        return ConfusionMatrixData(labels=[], matrix=[])

    with open(path, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        rows = list(reader)

    if not rows:
        return ConfusionMatrixData(labels=[], matrix=[])

    # Header row: ['', 'Predicted: Benign', 'Predicted: Malignant', ...]
    header = rows[0]
    labels = [h.replace("Predicted:", "").strip() for h in header[1:]]

    matrix = []
    for row in rows[1:]:
        matrix_row = [int(val.strip()) for val in row[1:]]
        matrix.append(matrix_row)

    return ConfusionMatrixData(labels=labels, matrix=matrix)


def _parse_classification_report(path: Path) -> List[ClassificationReportRow]:
    if not path.exists():
        return []

    with open(path, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        rows = list(reader)

    if not rows:
        return []

    report_rows = []
    # Header: ['', 'precision', 'recall', 'f1-score', 'support']
    for row in rows[1:]:
        if len(row) < 5:
            continue
        label = row[0].strip()
        try:
            prec = float(row[1].strip())
            rec = float(row[2].strip())
            f1 = float(row[3].strip())
            supp = float(row[4].strip())
        except ValueError:
            continue

        report_rows.append(
            ClassificationReportRow(
                label=label,
                precision=prec,
                recall=rec,
                f1_score=f1,
                support=supp
            )
        )
    return report_rows


def get_dataset_metrics(dataset: str) -> DatasetMetrics:
    cv_summary_path = _find_path(
        f"docs/nested_cross_validation/{dataset}/nested_cv_summary.csv",
        f"docs/nested_cross_validation/{dataset}/nested_cv_summary.csv"
    )
    cv_matrix_path = _find_path(
        f"docs/nested_cross_validation/{dataset}/outer_confusion_matrix.csv",
        f"docs/nested_cross_validation/{dataset}/outer_confusion_matrix.csv"
    )
    outer_folds_path = _find_path(
        f"docs/nested_cross_validation/{dataset}/outer_fold_metrics.csv",
        f"docs/nested_cross_validation/{dataset}/outer_fold_metrics.csv"
    )
    test_summary_path = _find_path(
        f"model_development/final_models/{dataset}/test_summary.csv",
        f"model_development/final_models/{dataset}/test_summary.csv"
    )
    test_matrix_path = _find_path(
        f"model_development/final_models/{dataset}/test_confusion_matrix.csv",
        f"model_development/final_models/{dataset}/test_confusion_matrix.csv"
    )
    test_report_path = _find_path(
        f"model_development/final_models/{dataset}/test_classification_report.csv",
        f"model_development/final_models/{dataset}/test_classification_report.csv"
    )
    history_path = _find_path(
        f"model_development/final_models/{dataset}/final_training_history.csv",
        f"model_development/final_models/{dataset}/final_training_history.csv"
    )

    cv_summary_rows = _parse_csv_dicts(cv_summary_path)
    cv_summary = cv_summary_rows[0] if cv_summary_rows else {}

    test_summary_rows = _parse_csv_dicts(test_summary_path)
    test_summary = test_summary_rows[0] if test_summary_rows else {}

    outer_folds = _parse_csv_dicts(outer_folds_path)
    training_history = _parse_csv_dicts(history_path)

    outer_matrix = _parse_confusion_matrix(cv_matrix_path)
    test_matrix = _parse_confusion_matrix(test_matrix_path)
    test_report = _parse_classification_report(test_report_path)

    return DatasetMetrics(
        dataset=dataset,
        architecture="DenseNet121",
        nested_cv_summary=cv_summary,
        outer_fold_metrics=outer_folds,
        outer_confusion_matrix=outer_matrix,
        test_summary=test_summary,
        test_classification_report=test_report,
        test_confusion_matrix=test_matrix,
        training_history=training_history
    )


def get_all_metrics() -> AllMetricsResponse:
    return AllMetricsResponse(
        cancer=get_dataset_metrics("cancer"),
        covid=get_dataset_metrics("covid")
    )
