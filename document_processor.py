"""
Document Processor — Extract and sanitize text from uploaded files.
Supports: PDF, TXT, MD
Security: Content is extracted and sanitized; no execution of document content.
"""

import os
import re
import logging

logger = logging.getLogger(__name__)

# Maximum characters to extract from a document
MAX_EXTRACT_CHARS = 15000
PREVIEW_CHARS = 500


class DocumentProcessor:
    """Handles text extraction from uploaded research documents."""

    def extract(self, file_path: str) -> dict:
        """
        Extract text from a file and return structured content.
        Supports: .pdf, .txt, .md
        Returns: dict with 'text', 'word_count', 'preview'
        """
        ext = os.path.splitext(file_path)[1].lower()

        if ext == ".pdf":
            text = self._extract_pdf(file_path)
        elif ext in (".txt", ".md"):
            text = self._extract_text(file_path)
        else:
            raise ValueError(f"Unsupported file type: {ext}")

        # Sanitize extracted content
        text = self._sanitize_extracted_text(text)

        # Truncate if needed
        if len(text) > MAX_EXTRACT_CHARS:
            text = text[:MAX_EXTRACT_CHARS] + "\n\n[Document truncated at extraction limit]"

        word_count = len(text.split()) if text else 0
        preview = text[:PREVIEW_CHARS].strip() + ("..." if len(text) > PREVIEW_CHARS else "")

        return {
            "text": text,
            "word_count": word_count,
            "preview": preview
        }

    # ── Private ───────────────────────────────────────────────────────────

    def _extract_pdf(self, file_path: str) -> str:
        """Extract text from a PDF file using PyMuPDF."""
        try:
            try:
                import pymupdf as fitz  # PyMuPDF >= 1.24
            except ImportError:
                import fitz              # PyMuPDF < 1.24
            doc = fitz.open(file_path)
            pages = []
            for page_num, page in enumerate(doc, start=1):
                page_text = page.get_text("text")
                if page_text.strip():
                    pages.append(f"--- Page {page_num} ---\n{page_text.strip()}")
            doc.close()
            return "\n\n".join(pages)
        except ImportError:
            logger.warning("PyMuPDF not installed. Attempting basic PDF extraction.")
            return self._extract_pdf_fallback(file_path)
        except Exception as e:
            logger.error(f"PDF extraction failed: {e}")
            raise ValueError(f"Could not extract text from PDF: {e}")

    def _extract_pdf_fallback(self, file_path: str) -> str:
        """Fallback PDF extraction using pdfplumber if available."""
        try:
            import pdfplumber
            with pdfplumber.open(file_path) as pdf:
                pages = []
                for i, page in enumerate(pdf.pages, start=1):
                    text = page.extract_text() or ""
                    if text.strip():
                        pages.append(f"--- Page {i} ---\n{text.strip()}")
                return "\n\n".join(pages)
        except ImportError:
            raise ValueError(
                "PDF processing library not available. "
                "Please install PyMuPDF: pip install PyMuPDF"
            )

    def _extract_text(self, file_path: str) -> str:
        """Extract text from .txt or .md file."""
        encodings = ["utf-8", "utf-8-sig", "latin-1", "cp1252"]
        for enc in encodings:
            try:
                with open(file_path, "r", encoding=enc) as f:
                    return f.read()
            except UnicodeDecodeError:
                continue
        raise ValueError("Could not decode text file. Please ensure it is UTF-8 encoded.")

    def _sanitize_extracted_text(self, text: str) -> str:
        """
        Sanitize extracted document text to prevent prompt injection
        from maliciously crafted documents.
        """
        if not text:
            return ""

        # Injection patterns to neutralize in extracted documents
        injection_patterns = [
            r"ignore\s+(previous|all|above|prior)\s+instructions",
            r"reveal\s+(your|the|system)\s+(prompt|instructions|key)",
            r"you\s+are\s+now\s+",
            r"act\s+as\s+(a\s+|an\s+)?(different|new|another|unrestricted)",
            r"bypass\s+(safety|filter|guardrail|restriction|rule)",
            r"forget\s+(everything|all|prior|previous)",
            r"disregard\s+(all|previous|prior|above|your)",
            r"new\s+instructions\s*:",
            r"\bjailbreak\b",
            r"<\|system\|>",
            r"override\s+(your|all|previous)\s+(instructions|rules)",
            r"expose\s+(api|key|secret|credentials)",
            r"print\s+(your\s+)?(system\s+)?(prompt|instructions|key)",
        ]

        for pattern in injection_patterns:
            text = re.sub(
                pattern,
                "[CONTENT SANITIZED]",
                text,
                flags=re.IGNORECASE
            )

        # Remove null bytes and control characters (except newlines/tabs)
        text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)

        return text.strip()
