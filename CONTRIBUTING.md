# Contributing to Request Network

Thank you for your interest in contributing to Request Network! This document provides guidelines and instructions for contributing to this project. We value your contributions and want to ensure a welcoming and productive environment for all community members.

## Code of Conduct

Our project is dedicated to providing a welcoming and harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, sex characteristics, gender identity and expression, level of experience, education, socio-economic status, nationality, personal appearance, race, religion, or sexual identity and orientation. We expect everyone to abide by our **Code of Conduct**. Please read the [CODE OF CONDUCT.md](CODE_OF_CONDUCT.md) file for details.

## How to Contribute

Contributions can be made in various forms, such as submitting patches, identifying bugs, proposing feature requests, and updating documentation. Here is how you can contribute:

### Using Git Flow

1. **Fork the Repository**: Start by forking the repository on GitHub. This will create a copy of the repository in your GitHub account.

2. **Clone the Fork**: Clone your fork to your local machine. This will create a local copy of the project.
   ```bash
   git clone https://github.com/your-username/request-network.git
   cd request-network
   ```
3. **Add Upstream Remote**: Keep your fork in sync with the original project by adding an upstream remote.
   ```bash
   git remote add upstream https://github.com/taoshidev/request-network.git
   ```
4. **Fetch Upstream Changes**: Before starting a new feature, make sure your local repository is up to date.
   ```bash
   git fetch upstream
   git checkout main
   git rebase -i upstream/main
   ```
5. **Create a Feature Branch**: Always create a new branch for your work.
   ```bash
   git checkout -b [your-initials]--[your-feature-name]-[issue-number]
   ```

## Making Changes

1. **Implement Changes**: Make your changes in the local feature branch. Keep your changes as focused as possible. This facilitates easier review and faster acceptance.
2. **Write Commit Messages**: Use Karma Commit Style for commit messages. This style helps in understanding the context and purpose of a change.
   ```bash
   git commit -m "feat(login): add new login feature"
   ```
3. **Pull the Latest Changes**: Regularly pull changes from the upstream main branch into your feature branch.
   ```bash
   git pull upstream main
   ```

## Submitting Changes

1. **Push Changes**: Push your changes to your GitHub repository.
   ```bash
   git push origin [your-initials]--[your-feature-name]-[issue-number]
   ```
2. **Create a Pull Request (PR)**: Go to GitHub and open a pull request from your feature branch to the main branch in the original repository. Provide a clear description of the changes and reference any related issues.
3. **Review Process**: Maintainers will review your pull request. Be receptive to feedback and make necessary revisions.

## Deployment and Merging

1. **Deploy to Staging**: After initial review, changes are deployed to the staging branch for sandbox testing. This step will be facilitated by the maintainers of Request Network.

2. **Final Review and Merge**: Once changes are validated in staging, a final review is conducted, and if approved, the changes are merged into the main branch for production deployment.

## Best Practices

- Write clean, testable, and efficient code.
  Follow coding standards and best practices for the technologies used.
- Document your code and ensure it is understandable.

## Be Kind and Respectful

Remember to be kind and professional in your interactions with other contributors. Open source is about collaboration and building something valuable together.

## Questions or Problems?

If you have questions or problems, feel free to open an issue in the repository or contact the maintainers.

Thank you for contributing to Request Network, and we look forward to your contributions!
