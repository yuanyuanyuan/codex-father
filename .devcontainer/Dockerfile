FROM mcr.microsoft.com/devcontainers/base:ubuntu

SHELL ["/bin/bash", "-lc"]

RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      ca-certificates curl git jq bash build-essential \
 && rm -rf /var/lib/apt/lists/*

# Convenience: create a non-root user matching VS Code devcontainer defaults
ARG USERNAME=vscode
ARG USER_UID=1000
ARG USER_GID=$USER_UID
RUN groupadd --gid $USER_GID $USERNAME \
 && useradd -s /bin/bash --uid $USER_UID --gid $USER_GID -m $USERNAME \
 && mkdir -p /home/$USERNAME/.local/bin \
 && chown -R $USERNAME:$USERNAME /home/$USERNAME

USER $USERNAME
WORKDIR /workspaces/codex-father

