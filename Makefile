# Darkheart - common tasks. `make help` lists them.
NAME   ?= darkheart
IMAGE  ?= localhost/darkheart:latest
PORT   ?= 8080
PODMAN ?= podman

.DEFAULT_GOAL := help
.PHONY: help test build run deploy stop logs status clean

help:  ## show this help
	@grep -E '^[a-z]+:.*## ' $(MAKEFILE_LIST) | sed -E 's/:.*## /\t/' | sort

test:  ## run the headless tests (smoke + sprites)
	node tests/smoke.js
	node tests/sprites.js

build:  ## build the container image with podman
	$(PODMAN) build -t $(IMAGE) -f Containerfile .

run:  ## (re)start the container from the current image (no tests, no build)
	-$(PODMAN) rm -f $(NAME) >/dev/null 2>&1
	$(PODMAN) run -d --name $(NAME) --restart=unless-stopped -p $(PORT):8000 \
	--read-only --cap-drop=ALL --security-opt=no-new-privileges \
	--health-cmd "wget -q -O /dev/null http://127.0.0.1:8000/arena.html" --health-interval 30s \
	$(IMAGE)
	@for i in 1 2 3 4 5 6 7 8 9 10; do curl -fs -o /dev/null http://127.0.0.1:$(PORT)/arena.html && break || sleep 1; done; \
	curl -fsS -o /dev/null http://127.0.0.1:$(PORT)/arena.html && echo "deployed: http://127.0.0.1:$(PORT)/arena.html" || { echo "deploy FAILED: not answering on port $(PORT)"; $(PODMAN) logs $(NAME); exit 1; }

deploy: test build run  ## test, build the image and (re)start the container

stop:  ## stop and remove the container
	-$(PODMAN) rm -f $(NAME)

logs:  ## follow the container logs
	$(PODMAN) logs -f $(NAME)

status:  ## container state and health
	$(PODMAN) ps -a --filter name=^$(NAME)$$ --format '{{.Names}}  {{.Status}}  {{.Ports}}'

clean: stop  ## remove the container and the image
	-$(PODMAN) rmi $(IMAGE)
