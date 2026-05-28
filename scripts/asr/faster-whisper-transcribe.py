import argparse
import json
import sys

from faster_whisper import WhisperModel


def parse_args():
    parser = argparse.ArgumentParser(
        description="Transcribe an audio file with faster-whisper and print JSON."
    )
    parser.add_argument("--audio", required=True)
    parser.add_argument("--model", default="small")
    parser.add_argument("--language", default=None)
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--compute-type", default="int8")
    parser.add_argument("--beam-size", default=5, type=int)
    parser.add_argument("--vad-filter", action="store_true")
    return parser.parse_args()


def main():
    args = parse_args()

    model = WhisperModel(
        args.model,
        compute_type=args.compute_type,
        device=args.device,
    )
    segments_iterator, info = model.transcribe(
        args.audio,
        beam_size=args.beam_size,
        language=args.language,
        vad_filter=args.vad_filter,
    )
    segments = [
        {
            "end": segment.end,
            "start": segment.start,
            "text": segment.text.strip(),
        }
        for segment in segments_iterator
        if segment.text.strip()
    ]
    text = "\n".join(segment["text"] for segment in segments)

    print(
        json.dumps(
            {
                "duration": info.duration,
                "language": info.language,
                "language_probability": info.language_probability,
                "segments": segments,
                "text": text,
            },
            ensure_ascii=True,
        )
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as caught:
        print(str(caught), file=sys.stderr)
        raise
