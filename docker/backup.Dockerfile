FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends default-mysql-client ca-certificates gzip \
    && python -m venv /opt/awscli \
    && /opt/awscli/bin/pip install --no-cache-dir --upgrade pip awscli \
    && ln -s /opt/awscli/bin/aws /usr/local/bin/aws \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY scripts/backup_db.sh /usr/local/bin/backup_db.sh
COPY scripts/restore_db.sh /usr/local/bin/restore_db.sh
COPY scripts/backup-entrypoint.sh /usr/local/bin/backup-entrypoint.sh
RUN chmod 0755 /usr/local/bin/backup_db.sh /usr/local/bin/restore_db.sh /usr/local/bin/backup-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/backup-entrypoint.sh"]
