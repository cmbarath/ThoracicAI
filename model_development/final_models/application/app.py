
# ============================================================
# THORACIC AI - STREAMLIT APPLICATION
# ============================================================

import io
import pandas as pd
import streamlit as st

from inference import (
    CLASS_NAMES,
    load_model,
    predict_scan
)


# ------------------------------------------------------------
# 1. PAGE CONFIGURATION
# ------------------------------------------------------------

st.set_page_config(
    page_title="Thoracic AI",
    page_icon="🫁",
    layout="wide"
)

st.title("Thoracic AI")
st.subheader("CT Image Classification Research Prototype")

st.markdown(
    """
    Experimental CT-image classification using
    ImageNet-pretrained DenseNet121 models.

    Choose a classification task and upload multiple
    CT slices belonging to the same examination.
    """
)

st.warning(
    "Research prototype only. This application is not "
    "a medical device and must not be used for diagnosis, "
    "treatment decisions, or clinical decision-making."
)

# ------------------------------------------------------------
# 2. MODEL LOADING
# ------------------------------------------------------------

@st.cache_resource(show_spinner="Loading DenseNet121 model...")
def get_cached_model(dataset_name):

    return load_model(dataset_name)


# ------------------------------------------------------------
# 3. DATASET SELECTION
# ------------------------------------------------------------

st.divider()

st.header("1. Select classification task")

dataset_choice = st.radio(
    "Choose the dataset/model:",
    options=[
        "Cancer classification",
        "COVID / pulmonary disease classification"
    ],
    horizontal=True
)

if dataset_choice == "Cancer classification":

    dataset_name = "cancer"

else:

    dataset_name = "covid"


# ------------------------------------------------------------
# 4. IMAGE UPLOAD
# ------------------------------------------------------------

st.header("2. Upload CT scan slices")

st.info(
    "Upload slices from one scan or one patient examination only. "
    "Do not combine images belonging to different patients."
)

uploaded_files = st.file_uploader(
    "Select CT image files",
    type=[
        "png",
        "jpg",
        "jpeg",
        "tif",
        "tiff",
        "bmp",
        "webp"
    ],
    accept_multiple_files=True
)

MAX_TOTAL_BYTES = 500 * 1024 * 1024

if uploaded_files:

    total_bytes = sum(
        file.size
        for file in uploaded_files
    )

    st.write(
        f"Selected images: **{len(uploaded_files)}**"
    )

    st.write(
        f"Total upload size: **{total_bytes / (1024 * 1024):.2f} MB**"
    )

    if total_bytes > MAX_TOTAL_BYTES:

        st.error(
            "Total upload exceeds the 500 MB application limit."
        )

    else:

        with st.expander("View uploaded filenames"):

            for file in uploaded_files:
                st.write(file.name)


# ------------------------------------------------------------
# 5. PREDICTION
# ------------------------------------------------------------

st.divider()

st.header("3. Run classification")

can_predict = (
    uploaded_files is not None
    and len(uploaded_files) > 0
    and sum(file.size for file in uploaded_files)
        <= MAX_TOTAL_BYTES
)

if st.button(
    "Analyze CT scan",
    type="primary",
    disabled=not can_predict,
    use_container_width=True
):

    image_payloads = [
        (file.name, file.getvalue())
        for file in uploaded_files
    ]

    try:

        model, metadata = get_cached_model(
            dataset_name
        )

        with st.spinner(
            "Processing images and generating predictions..."
        ):

            result = predict_scan(
                dataset_name=dataset_name,
                image_payloads=image_payloads,
                model=model
            )

        st.success("Image processing completed.")

        # ----------------------------------------------------
        # 6. AGGREGATED RESULT
        # ----------------------------------------------------

        st.header("4. Scan-level result")

        col1, col2, col3 = st.columns(3)

        with col1:

            st.metric(
                "Predicted research class",
                result["predicted_class"]
            )

        with col2:

            st.metric(
                "Slices processed",
                result["number_of_slices"]
            )

        with col3:

            st.metric(
                "Architecture",
                result["architecture"]
            )

        st.caption(
            "The predicted class is based on the arithmetic "
            "mean of per-slice softmax scores."
        )

        # ----------------------------------------------------
        # 7. CLASS SCORES
        # ----------------------------------------------------

        st.subheader("Class score distribution")

        scores_df = pd.DataFrame({

            "Class": list(
                result["class_scores"].keys()
            ),

            "Mean softmax score (%)": [
                value * 100
                for value in result["class_scores"].values()
            ]

        })

        scores_df = scores_df.sort_values(
            "Mean softmax score (%)",
            ascending=False
        )

        st.dataframe(
            scores_df.style.format({
                "Mean softmax score (%)": "{:.2f}%"
            }),
            use_container_width=True,
            hide_index=True
        )

        st.bar_chart(
            scores_df.set_index("Class")
        )

        st.caption(
            "These are model softmax scores, not calibrated "
            "clinical probabilities or measures of diagnostic certainty."
        )

        # ----------------------------------------------------
        # 8. PER-SLICE RESULTS
        # ----------------------------------------------------

        st.subheader("Individual slice predictions")

        slice_df = pd.DataFrame(
            result["slice_predictions"]
        )

        slice_df["predicted_class_score"] = (
            slice_df["predicted_class_score"] * 100
        )

        slice_df = slice_df.rename(
            columns={
                "filename": "Filename",
                "predicted_class": "Predicted class",
                "predicted_class_score":
                    "Predicted class score (%)"
            }
        )

        st.dataframe(
            slice_df.style.format({
                "Predicted class score (%)": "{:.2f}%"
            }),
            use_container_width=True,
            hide_index=True
        )

        # ----------------------------------------------------
        # 9. DOWNLOAD RESULTS
        # ----------------------------------------------------

        csv_data = slice_df.to_csv(
            index=False
        ).encode("utf-8")

        st.download_button(
            label="Download slice-level results CSV",
            data=csv_data,
            file_name="thoracic_ai_slice_predictions.csv",
            mime="text/csv",
            use_container_width=True
        )

        # ----------------------------------------------------
        # 10. SINGLE-SLICE WARNING
        # ----------------------------------------------------

        if result["number_of_slices"] == 1:

            st.warning(
                "Only one image was provided. Its prediction is "
                "a single-slice result and is not directly comparable "
                "to the multi-slice group-level evaluation."
            )

        # ----------------------------------------------------
        # 11. PRIVACY AND LIMITATIONS
        # ----------------------------------------------------

        with st.expander("Privacy and model limitations"):

            st.markdown(
                """
                - The application does not explicitly save uploaded
                  image files to disk.
                - Use only appropriately de-identified images.
                - The cancer preprocessing crop is not guaranteed
                  to remove every identifying annotation.
                - Model scores are not calibrated probabilities.
                - Performance depends on the source datasets and
                  image acquisition conditions.
                - This prototype has not been clinically validated.
                """
            )

    except Exception as error:

        st.error(
            "Unable to complete inference."
        )

        st.exception(error)


# ------------------------------------------------------------
# 12. FOOTER
# ------------------------------------------------------------

st.divider()

st.caption(
    "Thoracic AI | DenseNet121 | Experimental Research Prototype"
)
