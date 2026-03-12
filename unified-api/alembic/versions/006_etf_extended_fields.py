"""add extended etf metadata and risk columns

Revision ID: 006
Revises: 005
Create Date: 2026-03-07
"""

from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None

NEW_COLUMNS = [
    ("index_name", sa.String(200)),
    ("index_description", sa.Text),
    ("investment_focus", sa.String(200)),
    ("legal_structure", sa.String(100)),
    ("strategy_risk", sa.String(50)),
    ("sustainability", sa.String(200)),
    ("fund_currency", sa.String(10)),
    ("currency_risk", sa.String(100)),
    ("distribution_frequency", sa.String(50)),
    ("fund_provider", sa.String(200)),
    ("vol_5y", sa.Numeric(6, 2)),
    ("ret_risk_3y", sa.Numeric(6, 2)),
    ("ret_risk_5y", sa.Numeric(6, 2)),
    ("max_dd_3y", sa.Numeric(6, 2)),
    ("max_dd_5y", sa.Numeric(6, 2)),
    ("max_dd_inception", sa.Numeric(6, 2)),
    ("top10_weight", sa.Numeric(6, 2)),
    ("holdings_in_index", sa.Integer),
]


def upgrade() -> None:
    for col_name, col_type in NEW_COLUMNS:
        op.add_column("etfs", sa.Column(col_name, col_type, nullable=True))


def downgrade() -> None:
    for col_name, _ in reversed(NEW_COLUMNS):
        op.drop_column("etfs", col_name)
