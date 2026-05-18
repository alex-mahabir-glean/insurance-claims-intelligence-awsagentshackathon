"""pytest fixtures + module-level env setup.

Env vars must be set BEFORE pytest collects test files because the test
files import services.* which create boto3 resources at module load time.
"""
from __future__ import annotations

import os
import types

# Module-level env setup (runs at collection time)
os.environ.setdefault("AWS_ACCESS_KEY_ID", "testing")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "testing")
os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")
os.environ.setdefault("CLAIMS_TABLE", "TestClaims")
os.environ.setdefault("REVIEWERS_TABLE", "TestReviewers")
os.environ.setdefault("AUDIT_TABLE", "TestAudit")
os.environ.setdefault("POWERTOOLS_SERVICE_NAME", "api_handler-test")
os.environ.setdefault("POWERTOOLS_TRACE_DISABLED", "true")
os.environ.setdefault("POWERTOOLS_METRICS_NAMESPACE", "InsuranceClaims/Test")

import boto3
import pytest
from moto import mock_aws


@pytest.fixture
def lambda_context() -> object:
    ctx = types.SimpleNamespace()
    ctx.function_name = "test-fn"
    ctx.memory_limit_in_mb = 128
    ctx.invoked_function_arn = "arn:aws:lambda:us-east-1:123:function:test-fn"
    ctx.aws_request_id = "00000000-0000-0000-0000-000000000000"
    return ctx


@pytest.fixture
def dynamo_tables() -> object:
    with mock_aws():
        ddb = boto3.resource("dynamodb", region_name="us-east-1")

        ddb.create_table(
            TableName="TestClaims",
            KeySchema=[{"AttributeName": "claimId", "KeyType": "HASH"}],
            AttributeDefinitions=[
                {"AttributeName": "claimId", "AttributeType": "S"},
                {"AttributeName": "status", "AttributeType": "S"},
                {"AttributeName": "assignedTo", "AttributeType": "S"},
            ],
            GlobalSecondaryIndexes=[
                {
                    "IndexName": "StatusIndex",
                    "KeySchema": [{"AttributeName": "status", "KeyType": "HASH"}],
                    "Projection": {"ProjectionType": "ALL"},
                },
                {
                    "IndexName": "AssignedToIndex",
                    "KeySchema": [{"AttributeName": "assignedTo", "KeyType": "HASH"}],
                    "Projection": {"ProjectionType": "ALL"},
                },
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        ddb.create_table(
            TableName="TestReviewers",
            KeySchema=[{"AttributeName": "reviewerId", "KeyType": "HASH"}],
            AttributeDefinitions=[{"AttributeName": "reviewerId", "AttributeType": "S"}],
            BillingMode="PAY_PER_REQUEST",
        )
        ddb.create_table(
            TableName="TestAudit",
            KeySchema=[
                {"AttributeName": "claimId", "KeyType": "HASH"},
                {"AttributeName": "timestamp", "KeyType": "RANGE"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "claimId", "AttributeType": "S"},
                {"AttributeName": "timestamp", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        ddb.Table("TestReviewers").put_item(
            Item={"reviewerId": "sarah-chen", "displayName": "Sarah Chen", "currentWorkload": 3}
        )
        yield ddb
