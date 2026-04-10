FROM eclipse-temurin:21.0.7_6-jre-alpine
WORKDIR /app
COPY target/*.jar app.jar
EXPOSE 8289
ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-XX:+ExitOnOutOfMemoryError", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-jar", "app.jar"]
