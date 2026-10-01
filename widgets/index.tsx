import { WidgetBackground, WidgetText, WidgetLayout } from 'expo-widgets';

export default function SummaryWidget() {
    return (
        <WidgetBackground gradient={{ colors: ["#1a1a2e", "#2a2a4e"] }}>
            <WidgetLayout align="center" justify="center">
                <WidgetText style={{ color: "#ffffff", fontSize: 16 }}>
                    Mazo Check-in
                </WidgetText>
            </WidgetLayout>
        </WidgetBackground>
    )
}
