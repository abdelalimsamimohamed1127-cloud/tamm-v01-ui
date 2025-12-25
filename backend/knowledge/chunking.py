import re
from typing import List, Dict
import uuid

class TextChunker:
    """
    Splits text into semantic chunks suitable for embedding and RAG.
    This is a simplified implementation for Stage 3.
    """
    def __init__(self, max_chunk_size: int = 500, overlap: int = 50):
        self.max_chunk_size = max_chunk_size
        self.overlap = overlap

    def chunk_text(self, text: str, source_id: str = None) -> List[Dict]:
        """
        Splits text into chunks, attempting to maintain semantic boundaries.
        Returns a list of dictionaries, where each dict is a chunk.
        """
        # Simple splitting by paragraphs or sentences
        # For more advanced splitting, libraries like NLTK or spaCy would be used.
        paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
        chunks = []
        current_chunk_text = ""
        chunk_num = 0

        for paragraph in paragraphs:
            if len(current_chunk_text) + len(paragraph) + 2 < self.max_chunk_size: # +2 for newline
                current_chunk_text += (paragraph + "\n\n")
            else:
                if current_chunk_text:
                    chunks.append(self._create_chunk(current_chunk_text, source_id, chunk_num))
                    chunk_num += 1
                current_chunk_text = paragraph + "\n\n" # Start new chunk with current paragraph

        if current_chunk_text:
            chunks.append(self._create_chunk(current_chunk_text, source_id, chunk_num))

        # Further refine large chunks if any are still too big (e.g., very long paragraphs)
        final_chunks = []
        for chunk in chunks:
            if len(chunk['content']) > self.max_chunk_size:
                sentences = re.split(r'(?<=[.!?])\s+', chunk['content'])
                sub_chunk_text = ""
                sub_chunk_num = 0
                for sentence in sentences:
                    if len(sub_chunk_text) + len(sentence) + 1 < self.max_chunk_size:
                        sub_chunk_text += (sentence + " ")
                    else:
                        if sub_chunk_text:
                            final_chunks.append(self._create_chunk(sub_chunk_text, source_id, f"{chunk['chunk_id']}-{sub_chunk_num}"))
                            sub_chunk_num += 1
                        sub_chunk_text = sentence + " "
                if sub_chunk_text:
                    final_chunks.append(self._create_chunk(sub_chunk_text, source_id, f"{chunk['chunk_id']}-{sub_chunk_num}"))
            else:
                final_chunks.append(chunk)

        return final_chunks

    def _create_chunk(self, content: str, source_id: str, chunk_num) -> Dict:
        return {
            "chunk_id": f"{source_id}_{chunk_num}" if source_id else str(uuid.uuid4()),
            "content": content.strip(),
            "metadata": {
                "source_id": source_id,
                "chunk_number": chunk_num,
                # Add other metadata as needed
            }
        }
