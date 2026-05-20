# Top-level convenience wrapper.
# All real work lives under terraform/.

.PHONY: help bootstrap-backend init plan apply destroy verify load-sample-data glean-specs

help:
	@$(MAKE) -C terraform help
	@echo ""
	@echo "Project-level extras:"
	@echo "  verify             Smoke-test the deployed stack (terraform/scripts/verify_deployment.py)"
	@echo "  load-sample-data   Reseed sample claims/reviewers (terraform/scripts/load_sample_data.py)"
	@echo "  glean-specs        Generate Glean-ready OpenAPI specs (terraform/scripts/generate_glean_specs.py)"

bootstrap-backend:
	@$(MAKE) -C terraform bootstrap-backend

init:
	@$(MAKE) -C terraform init ENV=$(ENV)

plan:
	@$(MAKE) -C terraform plan

apply:
	@$(MAKE) -C terraform apply

destroy:
	@$(MAKE) -C terraform destroy

verify:
	cd terraform && python3 scripts/verify_deployment.py $(if $(PROFILE),--profile $(PROFILE))

load-sample-data:
	cd terraform && python3 scripts/load_sample_data.py $(if $(PROFILE),--profile $(PROFILE))

glean-specs:
	cd terraform && python3 scripts/generate_glean_specs.py
