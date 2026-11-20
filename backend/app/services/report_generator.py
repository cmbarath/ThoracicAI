"""Professional multi-format report generator (PDF, CSV, JSON) using ReportLab."""

import io
import json
import csv
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas for dynamic 'Page X of Y' numbering and running header/footer."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count: int):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))

        # Running Header (pages 2+)
        if self._pageNumber > 1:
            self.drawString(
                54,
                750,
                "ThoracicAI — CT Research & Classification Report"
            )
            self.setStrokeColor(colors.HexColor("#cbd5e1"))
            self.setLineWidth(0.5)
            self.line(54, 744, 558, 744)

        # Running Footer (all pages)
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.5)
        self.line(54, 45, 558, 45)

        self.drawString(
            54,
            32,
            "CONFIDENTIAL RESEARCH DOCUMENT — NOT FOR CLINICAL DIAGNOSTIC USE"
        )
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 32, page_str)

        self.restoreState()


class ReportGenerator:
    """Multi-format clinical research report generation engine."""

    @staticmethod
    def generate_pdf(
        report_id: str,
        case_reference: str,
        dataset: str,
        architecture: str,
        model_version: str,
        number_of_slices: int,
        predicted_class: str,
        mean_scores: Dict[str, float],
        slice_predictions: List[Dict[str, Any]],
        created_at: Optional[datetime] = None
    ) -> bytes:
        """Generate high-fidelity multi-page PDF research report."""
        created_at = created_at or datetime.now(timezone.utc)
        timestamp_str = created_at.strftime("%Y-%m-%d %H:%M:%S UTC")
        buffer = io.BytesIO()

        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            leftMargin=54,
            rightMargin=54,
            topMargin=54,
            bottomMargin=54,
        )

        styles = getSampleStyleSheet()

        # Custom typography styles
        brand_style = ParagraphStyle(
            "BrandTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=24,
            leading=28,
            textColor=colors.HexColor("#0f172a")
        )
        sub_style = ParagraphStyle(
            "SubTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=12,
            leading=16,
            textColor=colors.HexColor("#0284c7")
        )
        h2_style = ParagraphStyle(
            "Heading2Custom",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=17,
            textColor=colors.HexColor("#0f172a"),
            spaceBefore=12,
            spaceAfter=6
        )
        body_style = ParagraphStyle(
            "BodyCustom",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=13,
            textColor=colors.HexColor("#334155")
        )
        disclaimer_style = ParagraphStyle(
            "DisclaimerText",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#991b1b")
        )

        story = []

        # ============================================================
        # PAGE 1: COVER & EXECUTIVE SUMMARY
        # ============================================================
        story.append(Paragraph("ThoracicAI", brand_style))
        story.append(Paragraph("CT Research & Classification Workbench", sub_style))
        story.append(Spacer(1, 12))
        story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0284c7"), spaceAfter=14))

        # Metadata Table
        meta_data = [
            [
                Paragraph("<b>Report Identifier:</b>", body_style),
                Paragraph(f"<font name='Courier'>{report_id}</font>", body_style),
                Paragraph("<b>Creation Timestamp:</b>", body_style),
                Paragraph(timestamp_str, body_style)
            ],
            [
                Paragraph("<b>Case Reference:</b>", body_style),
                Paragraph(f"<b><font name='Courier' color='#0284c7'>{case_reference}</font></b>", body_style),
                Paragraph("<b>Classification Workflow:</b>", body_style),
                Paragraph(f"{dataset.upper()} Classification", body_style)
            ],
            [
                Paragraph("<b>Model Architecture:</b>", body_style),
                Paragraph(f"{architecture} (v{model_version})", body_style),
                Paragraph("<b>Exam Slices Evaluated:</b>", body_style),
                Paragraph(str(number_of_slices), body_style)
            ]
        ]
        meta_table = Table(meta_data, colWidths=[110, 142, 110, 142])
        meta_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 16))

        # Executive Abstract
        story.append(Paragraph("Executive Research Abstract", h2_style))
        story.append(Paragraph(
            "This document summarizes automated deep learning inference performed on an axial chest "
            "CT examination series using an ImageNet-pretrained DenseNet-121 architecture. "
            "The model processes individual slice cross-sections independently and computes continuous "
            "softmax activations. The aggregate examination classification is derived via the arithmetic "
            "mean of slice probability vectors.",
            body_style
        ))
        story.append(Spacer(1, 14))

        # Prominent Research Disclaimer Box
        disclaimer_content = [
            [
                Paragraph(
                    "<b>WARNING: RESEARCH USE ONLY — NOT A CLINICALLY VALIDATED MEDICAL DEVICE</b><br/>"
                    "This software platform and generated report are intended exclusively for academic research, "
                    "benchmarking, and algorithmic inspection. This model is not cleared or approved by the FDA, "
                    "CE, or any medical regulatory authority. Under no circumstances should these findings be used "
                    "as a diagnostic determination, patient management guide, or substitute for certified clinical review.",
                    disclaimer_style
                )
            ]
        ]
        disclaimer_table = Table(disclaimer_content, colWidths=[504])
        disclaimer_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#fef2f2")),
            ('BOX', (0, 0), (-1, -1), 1.0, colors.HexColor("#f87171")),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('LEFTPADDING', (0, 0), (-1, -1), 12),
            ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ]))
        story.append(disclaimer_table)
        story.append(Spacer(1, 20))

        # Page 1 Break
        story.append(PageBreak())

        # ============================================================
        # PAGE 2: AGGREGATE RESULTS & SCORE DISTRIBUTION
        # ============================================================
        story.append(Paragraph("Examination Aggregated Findings", brand_style))
        story.append(Paragraph("Primary Classification & Score Vector", sub_style))
        story.append(Spacer(1, 8))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#cbd5e1"), spaceAfter=12))

        # Big Result Banner
        result_color = "#0284c7"
        if predicted_class.lower() in ("malignant", "covid-19"):
            result_color = "#dc2626"
        elif predicted_class.lower() == "normal":
            result_color = "#16a34a"

        pred_title = Paragraph(
            f"<font size='10' color='#64748b'>PREDICTED RESEARCH CLASS</font><br/>"
            f"<b><font size='22' color='{result_color}'>{predicted_class.upper()}</font></b>",
            body_style
        )
        conf_score = mean_scores.get(predicted_class, 0.0) * 100
        score_title = Paragraph(
            f"<font size='10' color='#64748b'>MEAN ARITHMETIC SOFTMAX SCORE</font><br/>"
            f"<b><font size='22' color='#0f172a'>{conf_score:.2f}%</font></b>",
            body_style
        )
        banner_table = Table([[pred_title, score_title]], colWidths=[252, 252])
        banner_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 12),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('LEFTPADDING', (0, 0), (-1, -1), 14),
            ('RIGHTPADDING', (0, 0), (-1, -1), 14),
        ]))
        story.append(banner_table)
        story.append(Spacer(1, 16))

        # Class Distribution Table
        story.append(Paragraph("Arithmetic Mean Class Scores", h2_style))
        score_rows = [
            [
                Paragraph("<b>Classification Category</b>", body_style),
                Paragraph("<b>Mean Softmax Score (%)</b>", body_style),
                Paragraph("<b>Normalized Logit Output</b>", body_style)
            ]
        ]
        for c_name, score in sorted(mean_scores.items(), key=lambda x: x[1], reverse=True):
            is_winner = (c_name == predicted_class)
            pct = f"{score * 100:.2f}%"
            score_rows.append([
                Paragraph(f"{'<b>' if is_winner else ''}{c_name}{' (Selected)' if is_winner else ''}{'</b>' if is_winner else ''}", body_style),
                Paragraph(f"{'<b>' if is_winner else ''}{pct}{'</b>' if is_winner else ''}", body_style),
                Paragraph(f"<font name='Courier'>{score:.4f}</font>", body_style)
            ])

        score_table = Table(score_rows, colWidths=[204, 150, 150])
        score_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(score_table)
        story.append(Spacer(1, 14))

        # Preprocessing & Aggregation Block
        story.append(Paragraph("Preprocessing & Aggregation Specification", h2_style))
        prep_desc = (
            "<b>Cancer Crop V2:</b> 12% top, 10% bottom, 6% left/right margins cropped; padded to 224×224 via LANCZOS."
            if dataset == "cancer"
            else "<b>COVID Protocol:</b> Aspect ratio preserved with black border padding to 224×224 (no spatial cropping)."
        )
        spec_text = (
            f"{prep_desc}<br/>"
            f"<b>Normalization:</b> ImageNet distribution (mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]).<br/>"
            f"<b>Aggregation Formula:</b> Arithmetic mean across all evaluated slices: "
            f"<code>p_bar(c) = (1/S) * sum(p(c | s_i))</code>. Argmax selection: <code>y_hat = argmax(p_bar(c))</code>."
        )
        story.append(Paragraph(spec_text, body_style))
        story.append(Spacer(1, 20))

        # Page 2 Break
        story.append(PageBreak())

        # ============================================================
        # PAGE 3+: SLICE-LEVEL INFERENCES & METHODOLOGY
        # ============================================================
        story.append(Paragraph("Per-Slice Model Inferences", brand_style))
        story.append(Paragraph(f"Detailed Examination Breakdown ({len(slice_predictions)} Slices)", sub_style))
        story.append(Spacer(1, 8))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#cbd5e1"), spaceAfter=12))

        # Slice Table
        slice_table_data = [
            [
                Paragraph("<b>#</b>", body_style),
                Paragraph("<b>Slice Filename</b>", body_style),
                Paragraph("<b>Predicted Class</b>", body_style),
                Paragraph("<b>Top Score</b>", body_style)
            ]
        ]
        for s in slice_predictions:
            idx = s.get("slice_index", 1)
            fname = s.get("filename", f"slice_{idx}")
            pred_c = s.get("predicted_class", "Unknown")
            top_s = s.get("predicted_class_score", 0.0) * 100
            slice_table_data.append([
                Paragraph(f"<font name='Courier'>#{idx}</font>", body_style),
                Paragraph(fname[:32], body_style),
                Paragraph(pred_c, body_style),
                Paragraph(f"{top_s:.2f}%", body_style)
            ])

        slice_table = Table(slice_table_data, colWidths=[40, 244, 120, 100])
        slice_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(slice_table)
        story.append(Spacer(1, 16))

        # Methodology & Final Governance Section
        story.append(KeepTogether([
            Paragraph("Methodology & Limitations", h2_style),
            Paragraph(
                "• <b>Dataset Leakage Protection:</b> Evaluated on isolated graph-connected components to eliminate "
                "slice duplication contamination across train and test sets.<br/>"
                "• <b>Uncalibrated Probabilities:</b> Softmax activations represent mathematical network outputs under "
                "cross-entropy optimization, not calibrated epidemiological likelihoods or clinical certainty.<br/>"
                "• <b>Cohort Constraints:</b> The independent test partition includes 13 cancer leakage groups and 32 COVID groups. "
                "Generalization across unstandardized scanner equipment or slice protocols has not been clinically certified.<br/>"
                "• <b>Format Boundary:</b> Supported static image formats: PNG, JPG, TIFF, BMP, WebP. "
                "DICOM and volumetric NIfTI workflows require separate, prospective validation.",
                body_style
            ),
            Spacer(1, 10),
            Paragraph(
                f"<font color='#64748b'>Report Reference: {report_id} • Generated automatically by ThoracicAI Engine v{model_version}</font>",
                disclaimer_style
            )
        ]))

        doc.build(story, canvasmaker=NumberedCanvas)
        return buffer.getvalue()

    @staticmethod
    def generate_csv(
        case_reference: str,
        dataset: str,
        architecture: str,
        model_version: str,
        predicted_class: str,
        mean_scores: Dict[str, float],
        slice_predictions: List[Dict[str, Any]]
    ) -> bytes:
        """Generate formatted CSV with case metadata and per-slice distributions."""
        output = io.StringIO()
        writer = csv.writer(output)

        # Metadata comments
        writer.writerow(["# ThoracicAI Research Classification Export"])
        writer.writerow(["# Case Reference", case_reference])
        writer.writerow(["# Workflow Dataset", dataset])
        writer.writerow(["# Architecture", architecture])
        writer.writerow(["# Model Version", model_version])
        writer.writerow(["# Aggregate Predicted Class", predicted_class])
        for c_name, score in mean_scores.items():
            writer.writerow([f"# Mean Score - {c_name}", f"{score * 100:.2f}%"])
        writer.writerow([])

        # Table Header
        class_names = list(mean_scores.keys())
        headers = ["Slice Index", "Filename", "Predicted Class", "Predicted Score (%)"]
        for c in class_names:
            headers.append(f"{c} Score (%)")
        writer.writerow(headers)

        # Slice Rows
        for s in slice_predictions:
            idx = s.get("slice_index", 1)
            fname = s.get("filename", f"slice_{idx}")
            p_class = s.get("predicted_class", "")
            p_score = f"{s.get('predicted_class_score', 0.0) * 100:.2f}"
            row = [idx, fname, p_class, p_score]
            scores_dict = s.get("class_scores", {})
            for c in class_names:
                c_score = scores_dict.get(c, 0.0)
                row.append(f"{c_score * 100:.2f}")
            writer.writerow(row)

        return output.getvalue().encode("utf-8")

    @staticmethod
    def generate_json(
        report_id: str,
        case_reference: str,
        dataset: str,
        architecture: str,
        model_version: str,
        number_of_slices: int,
        predicted_class: str,
        mean_scores: Dict[str, float],
        slice_predictions: List[Dict[str, Any]],
        created_at: Optional[datetime] = None
    ) -> bytes:
        """Generate structured versioned JSON report payload."""
        created_at = created_at or datetime.now(timezone.utc)
        payload = {
            "$schema": "https://thoracicai.local/schemas/report-v1.json",
            "report_id": report_id,
            "case_reference": case_reference,
            "generated_at": created_at.isoformat(),
            "model": {
                "dataset": dataset,
                "architecture": architecture,
                "version": model_version,
                "aggregation_method": "Arithmetic mean of slice-level softmax score vectors"
            },
            "findings": {
                "number_of_slices": number_of_slices,
                "predicted_class": predicted_class,
                "mean_class_scores": {k: round(v, 6) for k, v in mean_scores.items()},
                "is_single_slice": (number_of_slices == 1)
            },
            "slice_predictions": slice_predictions,
            "governance": {
                "research_use_only": True,
                "clinical_diagnostic_use_prohibited": True,
                "uncalibrated_probabilities_warning": (
                    "Softmax scores are uncalibrated mathematical network outputs "
                    "and do not constitute clinical probabilities."
                )
            }
        }
        return json.dumps(payload, indent=2).encode("utf-8")
