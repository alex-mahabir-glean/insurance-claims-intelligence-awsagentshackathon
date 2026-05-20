TERRAFORM ?= terraform
TFLINT ?= tflint
ENV ?= dev

.PHONY: help bootstrap-backend init plan apply destroy fmt validate lint clean verify-modules

help:
	@echo "Targets:"
	@echo "  bootstrap-backend  One-shot: create the S3+DynamoDB state backend (run once per account/region)"
	@echo "  init               Initialize terraform (ENV=dev|staging|prod, defaults to dev)"
	@echo "  plan               Show planned changes (uses terraform.tfvars if present)"
	@echo "  apply              Apply changes"
	@echo "  destroy            Destroy resources (CAREFUL)"
	@echo "  fmt                terraform fmt --recursive"
	@echo "  validate           terraform init -backend=false && terraform validate"
	@echo "  lint               tflint --recursive"
	@echo "  verify-modules     Validate each module in modules/ standalone (proves self-containment)"
	@echo "  clean              Remove .terraform/ directories"
	@echo ""
	@echo "Common flow:"
	@echo "  1. make bootstrap-backend                  # once per account/region"
	@echo "  2. cp env/dev.tfbackend.example env/dev.tfbackend  # edit with your values"
	@echo "  3. cp terraform.tfvars.example terraform.tfvars    # edit with your values"
	@echo "  4. make init ENV=dev"
	@echo "  5. make plan"
	@echo "  6. make apply"

bootstrap-backend:
	cd bootstrap/state-backend && $(TERRAFORM) init && $(TERRAFORM) apply

init:
	$(TERRAFORM) init -backend-config=env/$(ENV).tfbackend

plan:
	$(TERRAFORM) plan

apply:
	$(TERRAFORM) apply

destroy:
	$(TERRAFORM) destroy

fmt:
	$(TERRAFORM) fmt -recursive

validate:
	$(TERRAFORM) init -backend=false -upgrade
	$(TERRAFORM) validate

lint:
	$(TFLINT) --recursive

verify-modules:
	./scripts/verify_self_contained.sh

clean:
	find . -type d -name '.terraform' -exec rm -rf {} +
	find . -type f -name '.terraform.lock.hcl' -delete
