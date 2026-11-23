# Darkheart - common tasks. `make help` lists them.
NAME   ?= darkheart
IMAGE  ?= localhost/darkheart:latest
# PORT is the same outside and inside the container. HOST_ADDR = address on this machine to listen on (127.0.0.1 = this machine only).
# (No trailing comments after the values: make would keep the spaces in the value.)
PORT      ?= 6464
HOST_ADDR ?= 0.0.0.0
PODMAN ?= podman

.DEFAULT_GOAL := help
.PHONY: help test build run deploy info stop logs status clean

help:  ## show this help
	@grep -E '^[a-z]+:.*## ' $(MAKEFILE_LIST) | sed -E 's/:.*## /\t/' | sort

test:  ## run the headless tests (smoke + sprites)
	node tests/smoke.js
	node tests/sprites.js

build:  ## build the container image with podman
	$(PODMAN) build -t $(IMAGE) -f Containerfile .

run:  ## (re)start the container from the current image (no tests, no build)
	-$(PODMAN) rm -f $(NAME) >/dev/null 2>&1
	$(PODMAN) run -d --name $(NAME) --restart=unless-stopped -p $(HOST_ADDR):$(PORT):$(PORT) -e PORT=$(PORT) \
	--read-only --cap-drop=ALL --security-opt=no-new-privileges \
	--health-cmd "wget -q -O /dev/null http://127.0.0.1:$(PORT)/arena.html" --health-interval 30s \
	$(IMAGE)
	@for i in 1 2 3 4 5 6 7 8 9 10; do curl -fs -o /dev/null http://127.0.0.1:$(PORT)/arena.html && break || sleep 1; done; \
	curl -fsS -o /dev/null http://127.0.0.1:$(PORT)/arena.html && $(MAKE) --no-print-directory info || { echo "deploy FAILED: not answering on port $(PORT)"; $(PODMAN) logs $(NAME); exit 1; }

deploy: test build run  ## test, build the image and (re)start the container

info:  ## show where the game is deployed (server IP, port, URLs)
	@ip=$$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i < NF; i++) if ($$i == "src") print $$(i + 1)}'); \
	[ -n "$$ip" ] || ip=$$(hostname -I 2>/dev/null | awk '{print $$1}'); \
	echo "deployed:"; \
	echo "  container : $(NAME)  ($(IMAGE))  $$($(PODMAN) ps --filter name=^$(NAME)$$ --format '{{.Status}}')"; \
	echo "  server IP : $${ip:-unknown}   host: $$(hostname)"; \
	echo "  port      : $(PORT)   (listening on $(HOST_ADDR))"; \
	echo "  game      : http://$${ip:-<server-ip>}:$(PORT)/arena.html"; \
	echo "  local     : http://127.0.0.1:$(PORT)/arena.html"; \
	ip -4 -o addr show scope global 2>/dev/null | awk -v main="$$ip" '$$2 !~ /^(podman|docker|veth|br-|cni|virbr|lo)/ { split($$4, a, "/"); if (a[1] != main) printf "  also      : http://%s:$(PORT)/arena.html  (%s)\n", a[1], $$2 }'

stop:  ## stop and remove the container
	-$(PODMAN) rm -f $(NAME)

logs:  ## follow the container logs
	$(PODMAN) logs -f $(NAME)

status:  ## container state and health
	$(PODMAN) ps -a --filter name=^$(NAME)$$ --format '{{.Names}}  {{.Status}}  {{.Ports}}'

clean: stop  ## remove the container and the image
	-$(PODMAN) rmi $(IMAGE)
