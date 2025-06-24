pipeline {
    agent any
    environment {
        // Define the GitHub Packages registry and credentials
        REGISTRY = "ghcr.io"
        IMAGE_NAME = "KOLLE1/LawHelp"
        GITHUB_CREDENTIALS = credentials('github-packages-credentials') // Jenkins credential ID for GitHub Packages
    }
    stages {
        stage('Checkout') {
            steps {
                // Clone the GitHub repository
                git url: "https://github.com/KOLLE1/LawHelp.git", branch: 'main'
            }
        }
        stage('Build Docker Image') {
            steps {
                script {
                    // Build the Docker image with the build number as the tag
                    dockerImage = docker.build("${REGISTRY}/${IMAGE_NAME}:${env.BUILD_NUMBER}")
                }
            }
        }
        stage('Push to GitHub Packages') {
            steps {
                script {
                    // Log in to GitHub Packages and push the image
                    docker.withRegistry("https://${REGISTRY}", 'github-packages-credentials') {
                        dockerImage.push()
                        dockerImage.push('latest')
                    }
                }
            }
        }
        stage('Clean Up') {
            steps {
                // Remove the local Docker image to save space
                bat "docker rmi ${REGISTRY}/${IMAGE_NAME}:${env.BUILD_NUMBER} || exit 0"
                bat "docker rmi ${REGISTRY}/${IMAGE_NAME}:latest || exit 0"
            }
        }
    }
    post {
        always {
            // Re-introduce a node block for bat commands in post-actions
            node {
                // Log out from GitHub Packages
                bat 'docker logout'
            }
        }
        success {
            // Re-introduce a node block for echo (though echo doesn't strictly need it, it's good practice)
            node {
                echo 'Docker image successfully built and pushed to GitHub Packages!'
            }
        }
        failure {
            // Re-introduce a node block for echo
            node {
                echo 'Build or push failed. Check the logs for details.'
            }
        }
    }
}