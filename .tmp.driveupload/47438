REVIEW_FILE?=

review:
if [ -z "$(REVIEW_FILE)" ]; then \
	echo "사용법: make review REVIEW_FILE=경로"; \
	exit 1; \
fi
	./bin/codex-code-review $(REVIEW_FILE)
