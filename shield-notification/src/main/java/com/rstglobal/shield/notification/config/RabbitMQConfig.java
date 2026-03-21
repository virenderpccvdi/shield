package com.rstglobal.shield.notification.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * RabbitMQ topology for the Shield event bus.
 *
 * Exchange : shield.events  (TopicExchange — durable)
 * Queue    : shield.notification.queue  (durable)
 * Binding  : routing key shield.# → captures all shield events
 *
 * Services publish with routing keys such as:
 *   shield.geofence.breach
 *   shield.sos.alert
 *   shield.budget.exhausted
 *   shield.ai.anomaly
 */
@Configuration
public class RabbitMQConfig {

    public static final String EXCHANGE_NAME = "shield.events";
    public static final String QUEUE_NAME    = "shield.notification.queue";
    public static final String ROUTING_KEY   = "shield.#";

    @Bean
    public TopicExchange shieldEventsExchange() {
        return new TopicExchange(EXCHANGE_NAME, true, false);
    }

    @Bean
    public Queue shieldNotificationQueue() {
        return new Queue(QUEUE_NAME, true);
    }

    @Bean
    public Binding shieldNotificationBinding(Queue shieldNotificationQueue,
                                             TopicExchange shieldEventsExchange) {
        return BindingBuilder
                .bind(shieldNotificationQueue)
                .to(shieldEventsExchange)
                .with(ROUTING_KEY);
    }

    @Bean
    public Jackson2JsonMessageConverter messageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory,
                                         Jackson2JsonMessageConverter messageConverter) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(messageConverter);
        return template;
    }

    @Bean
    public SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(
            ConnectionFactory connectionFactory,
            Jackson2JsonMessageConverter messageConverter) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(messageConverter);
        return factory;
    }
}
